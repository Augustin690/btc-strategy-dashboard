// orderbook.js — Order book data fetching + indicator computation

import { BINANCE_BASE, CONFIG } from './config.js';

/**
 * Fetch order book depth from Binance
 * @param {number} limit - Number of price levels (max 5000, default 1000)
 * @returns {{ bids: [price, qty][], asks: [price, qty][], timestamp: number }}
 */
export async function fetchOrderBook(limit = 1000) {
  const url = `${BINANCE_BASE}/depth?symbol=${CONFIG.symbol}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Depth fetch failed: ${resp.status}`);
  const raw = await resp.json();
  return {
    bids: raw.bids.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
    asks: raw.asks.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
    timestamp: Date.now(),
  };
}

/**
 * Fetch recent trades for VPIN calculation
 * @param {number} limit
 * @returns {{ price: number, qty: number, isBuyerMaker: boolean, time: number }[]}
 */
export async function fetchRecentTrades(limit = 1000) {
  const url = `${BINANCE_BASE}/trades?symbol=${CONFIG.symbol}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Trades fetch failed: ${resp.status}`);
  const raw = await resp.json();
  return raw.map(t => ({
    price: parseFloat(t.price),
    qty: parseFloat(t.qty),
    isBuyerMaker: t.isBuyerMaker,
    time: t.time,
  }));
}

/**
 * Market Imbalance: (totalBidVol - totalAskVol) / (totalBidVol + totalAskVol)
 * Range: -1 (all asks) to +1 (all bids)
 * Also computes imbalance at different depth levels (0.1%, 0.5%, 1%, 2%)
 */
export function computeImbalance(bids, asks, midPrice) {
  const levels = [0.001, 0.005, 0.01, 0.02]; // 0.1%, 0.5%, 1%, 2%
  const result = {};

  for (const pct of levels) {
    const upperBound = midPrice * (1 + pct);
    const lowerBound = midPrice * (1 - pct);
    const bidVol = bids.filter(([p]) => p >= lowerBound).reduce((s, [, q]) => s + q, 0);
    const askVol = asks.filter(([p]) => p <= upperBound).reduce((s, [, q]) => s + q, 0);
    const total = bidVol + askVol;
    result[pct] = {
      bidVol,
      askVol,
      imbalance: total > 0 ? (bidVol - askVol) / total : 0,
    };
  }

  // Overall imbalance (full book)
  const totalBid = bids.reduce((s, [, q]) => s + q, 0);
  const totalAsk = asks.reduce((s, [, q]) => s + q, 0);
  const totalAll = totalBid + totalAsk;
  result.total = {
    bidVol: totalBid,
    askVol: totalAsk,
    imbalance: totalAll > 0 ? (totalBid - totalAsk) / totalAll : 0,
  };

  return result;
}

/**
 * Order Book VWAP — volume-weighted average price from bids and asks separately
 * @returns {{ bidVwap: number, askVwap: number, midVwap: number, spread: number }}
 */
export function computeOBVwap(bids, asks) {
  let bidPV = 0, bidV = 0;
  for (const [p, q] of bids) {
    bidPV += p * q;
    bidV += q;
  }
  let askPV = 0, askV = 0;
  for (const [p, q] of asks) {
    askPV += p * q;
    askV += q;
  }
  const bidVwap = bidV > 0 ? bidPV / bidV : 0;
  const askVwap = askV > 0 ? askPV / askV : 0;
  return {
    bidVwap,
    askVwap,
    midVwap: (bidVwap + askVwap) / 2,
    spread: askVwap - bidVwap,
  };
}

/**
 * Slippage estimation — price impact for market orders of given sizes
 * @param {number[][]} bids - [[price, qty], ...]
 * @param {number[][]} asks - [[price, qty], ...]
 * @param {number} midPrice - Current mid price
 * @param {number[]} sizes - Order sizes in BTC (e.g., [1, 5, 10, 25])
 * @returns {{ buy: {size, avgPrice, slippagePct, slippageBps}[], sell: ... }}
 */
export function computeSlippage(bids, asks, midPrice, sizes = [1, 5, 10, 25]) {
  function walkBook(levels, targetQty) {
    let filled = 0, cost = 0;
    for (const [price, qty] of levels) {
      const fill = Math.min(qty, targetQty - filled);
      cost += fill * price;
      filled += fill;
      if (filled >= targetQty) break;
    }
    return filled > 0 ? { avgPrice: cost / filled, filled } : { avgPrice: midPrice, filled: 0 };
  }

  return {
    buy: sizes.map(size => {
      const { avgPrice, filled } = walkBook(asks, size);
      const slip = midPrice > 0 ? (avgPrice - midPrice) / midPrice : 0;
      return { size, avgPrice, filled, slippagePct: slip * 100, slippageBps: slip * 10000 };
    }),
    sell: sizes.map(size => {
      const { avgPrice, filled } = walkBook(bids, size);
      const slip = midPrice > 0 ? (midPrice - avgPrice) / midPrice : 0;
      return { size, avgPrice, filled, slippagePct: slip * 100, slippageBps: slip * 10000 };
    }),
  };
}

/**
 * Order Flow Toxicity (VPIN approximation)
 * Uses recent trades to estimate the probability of informed trading.
 * Buckets trades into volume buckets, measures buy/sell imbalance per bucket.
 * VPIN = mean(|buyVol - sellVol| / bucketSize) over N buckets
 * Range: 0 (balanced) to 1 (fully toxic / informed flow)
 *
 * @param {{ price: number, qty: number, isBuyerMaker: boolean }[]} trades
 * @param {number} numBuckets - Number of volume buckets (default 20)
 * @returns {{ vpin: number, buckets: { buyVol, sellVol, imbalance }[], avgBucketSize: number }}
 */
export function computeVPIN(trades, numBuckets = 20) {
  if (!trades || trades.length === 0) return { vpin: 0, buckets: [], avgBucketSize: 0 };

  // Total volume
  const totalVol = trades.reduce((s, t) => s + t.qty, 0);
  const bucketSize = totalVol / numBuckets;
  if (bucketSize === 0) return { vpin: 0, buckets: [], avgBucketSize: 0 };

  const buckets = [];
  let buyVol = 0, sellVol = 0, bucketVol = 0;

  for (const t of trades) {
    // isBuyerMaker = true means the buyer was the maker, so the trade was a SELL (taker sold)
    if (t.isBuyerMaker) {
      sellVol += t.qty;
    } else {
      buyVol += t.qty;
    }
    bucketVol += t.qty;

    if (bucketVol >= bucketSize) {
      buckets.push({ buyVol, sellVol, imbalance: Math.abs(buyVol - sellVol) / (buyVol + sellVol || 1) });
      buyVol = 0;
      sellVol = 0;
      bucketVol = 0;
    }
  }
  // Don't discard partial last bucket
  if (bucketVol > 0) {
    buckets.push({ buyVol, sellVol, imbalance: Math.abs(buyVol - sellVol) / (buyVol + sellVol || 1) });
  }

  const vpin = buckets.reduce((s, b) => s + b.imbalance, 0) / buckets.length;

  return { vpin, buckets, avgBucketSize: bucketSize };
}

/**
 * Build depth chart data: cumulative bid/ask volume at each price level
 * Filtered to ±0.5% from midPrice for readable zoom
 * @returns {{ bidDepth: [price, cumVol][], askDepth: [price, cumVol][] }}
 */
export function buildDepthData(bids, asks, midPrice) {
  const rangePct = 0.005;
  const lo = midPrice * (1 - rangePct);
  const hi = midPrice * (1 + rangePct);

  // Bids: sorted descending by price — accumulate from best bid down
  const bidDepth = [];
  let cumBid = 0;
  for (const [p, q] of bids) {
    if (p < lo) break;
    cumBid += q;
    bidDepth.push([p, cumBid]);
  }

  // Asks: sorted ascending by price — accumulate from best ask up
  const askDepth = [];
  let cumAsk = 0;
  for (const [p, q] of asks) {
    if (p > hi) break;
    cumAsk += q;
    askDepth.push([p, cumAsk]);
  }

  return { bidDepth, askDepth };
}

/**
 * Build heatmap data from order book — groups prices into bins and maps volume intensity
 * @param {number[][]} bids
 * @param {number[][]} asks
 * @param {number} midPrice
 * @param {number} binCount - number of price bins per side (default 50)
 * @returns {{ bins: { price, vol, side }[], maxVol: number }}
 */
export function buildHeatmapData(bids, asks, midPrice, binCount = 50) {
  // Define price range: ±2% from mid
  const rangePct = 0.02;
  const lo = midPrice * (1 - rangePct);
  const hi = midPrice * (1 + rangePct);
  const binSize = (hi - lo) / (binCount * 2);

  const bins = [];
  let maxVol = 0;

  // Aggregate volume into bins
  const volMap = new Map();
  const allLevels = [
    ...bids.map(([p, q]) => ({ p, q, side: 'bid' })),
    ...asks.map(([p, q]) => ({ p, q, side: 'ask' })),
  ];

  for (const { p, q, side } of allLevels) {
    if (p < lo || p > hi) continue;
    const binIdx = Math.floor((p - lo) / binSize);
    const key = `${binIdx}-${side}`;
    const existing = volMap.get(key) || { price: lo + binIdx * binSize + binSize / 2, vol: 0, side };
    existing.vol += q;
    volMap.set(key, existing);
  }

  for (const bin of volMap.values()) {
    bins.push(bin);
    if (bin.vol > maxVol) maxVol = bin.vol;
  }

  return { bins, maxVol, lo, hi, binSize };
}
