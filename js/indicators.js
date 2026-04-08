// indicators.js — Pure indicator computation functions (no side effects)

/**
 * Exponential Moving Average
 * @param {number[]} data - Close prices
 * @param {number} period - EMA period
 * @returns {number[]}
 */
export function computeEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

/**
 * Volume-Weighted Average Price (resets at UTC day boundaries)
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number[]} volumes
 * @param {number[]} timestamps - candle open timestamps (ms)
 * @returns {number[]}
 */
export function computeVWAP(highs, lows, closes, volumes, timestamps) {
  const vwap = [];
  let cumTPV = 0, cumVol = 0;
  let currentDay = timestamps ? new Date(timestamps[0]).getUTCDate() : -1;
  for (let i = 0; i < closes.length; i++) {
    // Reset accumulation at UTC day boundary
    if (timestamps) {
      const day = new Date(timestamps[i]).getUTCDate();
      if (day !== currentDay) {
        cumTPV = 0;
        cumVol = 0;
        currentDay = day;
      }
    }
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
    vwap.push(cumVol > 0 ? cumTPV / cumVol : tp);
  }
  return vwap;
}

/**
 * Bollinger Bands (SMA ± mult × stddev)
 * @param {number[]} data - Close prices
 * @param {number} period
 * @param {number} mult - Standard deviation multiplier
 * @returns {{ upper: number[], middle: number[], lower: number[] }}
 */
export function computeBB(data, period, mult) {
  const upper = [], middle = [], lower = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null); middle.push(null); lower.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period);
    middle.push(sma);
    upper.push(sma + mult * std);
    lower.push(sma - mult * std);
  }
  return { upper, middle, lower };
}

/**
 * Relative Strength Index (Wilder smoothing)
 * @param {number[]} data - Close prices
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function computeRSI(data, period) {
  const rsi = new Array(data.length).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/**
 * Average True Range
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function computeATR(highs, lows, closes, period) {
  const tr = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  const atr = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

/**
 * Choppiness Index
 * CHOP = 100 * LOG10(SUM(ATR(1), period) / (HH - LL)) / LOG10(period)
 * >61.8 = choppy/consolidation, <38.2 = trending
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function computeChop(highs, lows, closes, period) {
  // True Range series (ATR period=1)
  const tr = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  const chop = new Array(closes.length).fill(null);
  const log10Period = Math.log10(period);
  for (let i = period - 1; i < closes.length; i++) {
    let sumTR = 0;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      sumTR += tr[j];
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    const range = hh - ll;
    chop[i] = range > 0 ? 100 * Math.log10(sumTR / range) / log10Period : 50;
  }
  return chop;
}

/**
 * MACD (12, 26, 9)
 * @param {number[]} data - Close prices
 * @returns {{ macd: number[], signal: number[], histogram: number[] }}
 */
export function computeMACD(data) {
  const ema12 = computeEMA(data, 12);
  const ema26 = computeEMA(data, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = computeEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Compute all indicators from raw OHLCV arrays
 * @param {{ closes, highs, lows, volumes }} ohlcv
 * @param {object} config
 * @returns {object} All computed indicator arrays
 */
export function computeAll(ohlcv, config) {
  const { closes, highs, lows, volumes, timestamps } = ohlcv;
  return {
    ema9: computeEMA(closes, config.emaPeriods.fast),
    ema21: computeEMA(closes, config.emaPeriods.slow),
    vwap: computeVWAP(highs, lows, closes, volumes, timestamps),
    bb: computeBB(closes, config.bbPeriod, config.bbMult),
    rsi: computeRSI(closes, config.rsiPeriod),
    atr: computeATR(highs, lows, closes, config.atrPeriod),
    chop: computeChop(highs, lows, closes, config.chopPeriod || 14),
    macd: computeMACD(closes),
  };
}
