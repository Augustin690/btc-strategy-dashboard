// data.js — Binance REST API data fetching

import { BINANCE_BASE, CONFIG } from './config.js';

/**
 * Fetch kline (candlestick) data from Binance
 * Returns array of [timestamp, open, high, low, close, volume]
 */
export async function fetchKlines() {
  const url = `${BINANCE_BASE}/klines?symbol=${CONFIG.symbol}&interval=${CONFIG.interval}&limit=${CONFIG.candleCount}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Klines fetch failed: ${resp.status}`);
  const raw = await resp.json();
  // Binance kline: [openTime, open, high, low, close, volume, closeTime, ...]
  return raw.map(k => [
    k[0],                    // timestamp
    parseFloat(k[1]),        // open
    parseFloat(k[2]),        // high
    parseFloat(k[3]),        // low
    parseFloat(k[4]),        // close
    parseFloat(k[5]),        // volume
  ]);
}

/**
 * Fetch 24h ticker stats
 * Returns { last, high, low, volume, quoteVolume, changePct }
 */
export async function fetchTicker24h() {
  const url = `${BINANCE_BASE}/ticker/24hr?symbol=${CONFIG.symbol}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Ticker fetch failed: ${resp.status}`);
  const t = await resp.json();
  return {
    last: parseFloat(t.lastPrice),
    high: parseFloat(t.highPrice),
    low: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
    changePct: parseFloat(t.priceChangePercent),
  };
}

/**
 * Fetch all market data in parallel
 * @returns {{ klines: Array, ticker: object }}
 */
export async function fetchAll() {
  const [klines, ticker] = await Promise.all([
    fetchKlines(),
    fetchTicker24h(),
  ]);
  return { klines, ticker };
}

/**
 * Parse raw klines into separate OHLCV arrays
 */
export function parseOHLCV(klines) {
  return {
    timestamps: klines.map(k => k[0]),
    opens: klines.map(k => k[1]),
    highs: klines.map(k => k[2]),
    lows: klines.map(k => k[3]),
    closes: klines.map(k => k[4]),
    volumes: klines.map(k => k[5]),
  };
}
