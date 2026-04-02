// strategies.js — Strategy signal detection

import { fmt } from './config.js';

/**
 * Detect ORB status from first candle's high/low vs current price
 * @param {object} firstCandle - rawKlines[0]: [ts, o, h, l, c, v]
 * @param {number} currentPrice
 * @returns {{ orbHigh, orbLow, orbMid, status, signal, color }}
 */
export function detectORB(firstCandle, currentPrice) {
  const orbHigh = firstCandle[2];
  const orbLow = firstCandle[3];
  const orbMid = (orbHigh + orbLow) / 2;

  let status, signal, color;
  if (currentPrice > orbHigh) {
    status = 'BREAKOUT LONG'; signal = 'bullish'; color = 'var(--accent-green)';
  } else if (currentPrice < orbLow) {
    status = 'BREAKOUT SHORT'; signal = 'bearish'; color = 'var(--accent-red)';
  } else {
    status = 'INSIDE RANGE'; signal = 'neutral'; color = 'var(--accent-blue)';
  }
  return { orbHigh, orbLow, orbMid, status, signal, color };
}

/**
 * Detect VWAP Reclaim / Loss
 * @param {number} currentPrice
 * @param {number} prevClose
 * @param {number} vwapCurrent
 * @param {number} vwapPrev
 * @returns {{ status, signal, color }}
 */
export function detectVWAP(currentPrice, prevClose, vwapCurrent, vwapPrev) {
  let status, signal, color;
  if (currentPrice > vwapCurrent && prevClose < vwapPrev) {
    status = 'RECLAIMED ABOVE'; signal = 'bullish'; color = 'var(--accent-green)';
  } else if (currentPrice < vwapCurrent && prevClose > vwapPrev) {
    status = 'LOST VWAP'; signal = 'bearish'; color = 'var(--accent-red)';
  } else if (currentPrice > vwapCurrent) {
    status = 'ABOVE VWAP'; signal = 'bullish'; color = 'var(--accent-green)';
  } else {
    status = 'BELOW VWAP'; signal = 'bearish'; color = 'var(--accent-red)';
  }
  return { status, signal, color };
}

/**
 * Detect EMA Crossover state
 * @param {number} ema9Now
 * @param {number} ema21Now
 * @param {number} ema9Prev
 * @param {number} ema21Prev
 * @returns {{ status, signal, color }}
 */
export function detectEMACross(ema9Now, ema21Now, ema9Prev, ema21Prev) {
  let status, signal, color;
  if (ema9Now > ema21Now && ema9Prev <= ema21Prev) {
    status = 'GOLDEN CROSS'; signal = 'bullish'; color = 'var(--accent-green)';
  } else if (ema9Now < ema21Now && ema9Prev >= ema21Prev) {
    status = 'DEATH CROSS'; signal = 'bearish'; color = 'var(--accent-red)';
  } else if (ema9Now > ema21Now) {
    status = 'BULLISH TREND'; signal = 'bullish'; color = 'var(--accent-green)';
  } else {
    status = 'BEARISH TREND'; signal = 'bearish'; color = 'var(--accent-red)';
  }
  return { status, signal, color };
}

/**
 * Scan all candles for ORB/VWAP/EMA crossover signals
 * @param {object} params
 * @returns {Array<{ time, idx, type, strategy, msg }>}
 */
export function scanSignals({ closes, timestamps, vwap, ema9, ema21, orbHigh, orbLow, fmtTime }) {
  const signals = [];
  for (let i = 2; i < closes.length; i++) {
    const t = fmtTime(timestamps[i]);

    // ORB breakout / breakdown
    if (closes[i] > orbHigh && closes[i - 1] <= orbHigh) {
      signals.push({ time: t, idx: i, type: 'bullish', strategy: 'ORB', msg: 'Breakout above ORB High $' + fmt(orbHigh) });
    }
    if (closes[i] < orbLow && closes[i - 1] >= orbLow) {
      signals.push({ time: t, idx: i, type: 'bearish', strategy: 'ORB', msg: 'Breakdown below ORB Low $' + fmt(orbLow) });
    }

    // VWAP cross
    if (closes[i] > vwap[i] && closes[i - 1] <= vwap[i - 1]) {
      signals.push({ time: t, idx: i, type: 'bullish', strategy: 'VWAP', msg: 'Reclaimed VWAP at $' + fmt(vwap[i]) });
    }
    if (closes[i] < vwap[i] && closes[i - 1] >= vwap[i - 1]) {
      signals.push({ time: t, idx: i, type: 'bearish', strategy: 'VWAP', msg: 'Lost VWAP at $' + fmt(vwap[i]) });
    }

    // EMA cross
    if (ema9[i] > ema21[i] && ema9[i - 1] <= ema21[i - 1]) {
      signals.push({ time: t, idx: i, type: 'bullish', strategy: 'EMA', msg: 'EMA9/21 Golden Cross' });
    }
    if (ema9[i] < ema21[i] && ema9[i - 1] >= ema21[i - 1]) {
      signals.push({ time: t, idx: i, type: 'bearish', strategy: 'EMA', msg: 'EMA9/21 Death Cross' });
    }
  }
  return signals;
}
