// app.js — Main orchestration with auto-refresh loop

import { CONFIG, fmtTime } from './config.js';
import { fetchAll, parseOHLCV, fetchKlines } from './data.js';
import { computeAll, computeMACD } from './indicators.js';
import { detectORB, detectVWAP, detectEMACross, scanSignals } from './strategies.js';
import { renderMainChart, renderRsiChart } from './charts.js';
import {
  updateTimestamp, updateRefreshCountdown, updateMetrics,
  updateORBPanel, updateVWAPPanel, updateEMAPanel,
  updateSignalLog, updateVerdict, updateKeyLevels, showStatus
} from './ui.js';

let refreshTimer = null;
let countdownTimer = null;
let secondsLeft = 0;

/**
 * Core update cycle: fetch → compute → render
 */
async function update() {
  try {
    showStatus('Fetching live data from Binance...');

    // Fetch 15m klines + 24h ticker
    const { klines, ticker } = await fetchAll();

    // Also fetch 1h klines for multi-TF verdict (last 96 candles)
    let klines1h;
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${CONFIG.symbol}&interval=1h&limit=96`;
      const resp = await fetch(url);
      klines1h = (await resp.json()).map(k => [k[0], parseFloat(k[1]), parseFloat(k[2]), parseFloat(k[3]), parseFloat(k[4]), parseFloat(k[5])]);
    } catch {
      klines1h = null;
    }

    // Parse OHLCV
    const ohlcv = parseOHLCV(klines);
    const { timestamps, closes, highs, lows, volumes } = ohlcv;
    const categories = timestamps.map(fmtTime);

    // Compute all indicators
    const indicators = computeAll(ohlcv, CONFIG);
    const { ema9, ema21, vwap, bb, rsi, atr, chop, macd } = indicators;

    // Current values
    const n = closes.length - 1;
    const currentPrice = closes[n];
    const prevClose = closes[n - 1];
    const rsiValue = rsi[n];
    const atrValue = atr[n];
    const atrPct = atrValue != null ? (atrValue / currentPrice * 100) : null;
    const chopValue = chop[n];

    // Strategy detection
    // ORB: use the first candle of the current UTC day (not oldest candle in window)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const orbCandle = klines.find(k => k[0] >= todayStartMs) || klines[0];
    const orb = detectORB(orbCandle, currentPrice);
    const vwapState = detectVWAP(currentPrice, prevClose, vwap[n], vwap[n - 1]);
    const emaState = detectEMACross(ema9[n], ema21[n], ema9[n - 1], ema21[n - 1]);

    // Scan for crossover signals
    const signals = scanSignals({
      closes, timestamps, vwap, ema9, ema21,
      orbHigh: orb.orbHigh, orbLow: orb.orbLow, fmtTime
    });

    // Compute 1h MACD for multi-TF verdict
    let macd1h = { macd: 0, signal: 0 };
    if (klines1h) {
      const closes1h = klines1h.map(k => k[4]);
      const macd1hFull = computeMACD(closes1h);
      const m = closes1h.length - 1;
      macd1h = { macd: macd1hFull.macd[m], signal: macd1hFull.signal[m] };
    }

    // Derive support/resistance from recent swing lows/highs
    const supports = findSwingLows(lows, closes, 5).slice(0, 3);
    const resistances = findSwingHighs(highs, closes, 5).slice(0, 3);

    // ── Render everything ──

    updateTimestamp();

    updateMetrics({
      ticker,
      rsiValue,
      atrValue,
      atrPct,
      chopValue,
      ema9: ema9[n],
      ema21: ema21[n],
      macd: { macd: macd.macd[n], signal: macd.signal[n] },
      macdPrev: { macd: macd.macd[n - 1], signal: macd.signal[n - 1] }
    });

    updateORBPanel(orb, currentPrice);
    updateVWAPPanel(vwapState, currentPrice, prevClose, vwap[n], vwap[n - 1]);
    updateEMAPanel(emaState, currentPrice, ema9[n], ema21[n]);
    updateSignalLog(signals);

    updateVerdict(
      { macd: macd.macd[n], signal: macd.signal[n] },
      macd1h
    );

    updateKeyLevels(supports, resistances);

    renderMainChart({
      klines, categories, ema9, ema21, vwap, bb,
      orbHigh: orb.orbHigh, orbLow: orb.orbLow,
      signals, highs, lows
    });

    renderRsiChart({ categories, rsi });

    showStatus('');

  } catch (err) {
    console.error('Update failed:', err);
    showStatus('Update failed: ' + err.message + ' — retrying...', true);
  }
}

/**
 * Find swing lows (local minima within a window)
 */
function findSwingLows(lows, closes, window) {
  const swings = [];
  for (let i = window; i < lows.length - window; i++) {
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && lows[j] < lows[i]) { isLow = false; break; }
    }
    if (isLow) swings.push(lows[i]);
  }
  // Sort ascending (nearest below current price first)
  const current = closes[closes.length - 1];
  return [...new Set(swings)].filter(l => l < current).sort((a, b) => b - a);
}

/**
 * Find swing highs (local maxima within a window)
 */
function findSwingHighs(highs, closes, window) {
  const swings = [];
  for (let i = window; i < highs.length - window; i++) {
    let isHigh = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && highs[j] > highs[i]) { isHigh = false; break; }
    }
    if (isHigh) swings.push(highs[i]);
  }
  const current = closes[closes.length - 1];
  return [...new Set(swings)].filter(h => h > current).sort((a, b) => a - b);
}

/**
 * Start countdown display
 */
function startCountdown() {
  secondsLeft = CONFIG.refreshIntervalMs / 1000;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    secondsLeft--;
    if (secondsLeft < 0) secondsLeft = CONFIG.refreshIntervalMs / 1000;
    updateRefreshCountdown(secondsLeft);
  }, 1000);
}

/**
 * Start the auto-refresh loop
 */
export function start() {
  // Initial load
  update();

  // Schedule recurring refresh
  refreshTimer = setInterval(update, CONFIG.refreshIntervalMs);
  startCountdown();

  console.log(`[Dashboard] Auto-refresh every ${CONFIG.refreshIntervalMs / 1000}s`);
}

/**
 * Stop the auto-refresh loop
 */
export function stop() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (countdownTimer) clearInterval(countdownTimer);
}

// Auto-start on module load
start();
