// config.js — Dashboard configuration and constants

export const CONFIG = {
  symbol: 'BTCUSDT',
  displaySymbol: 'BTC/USDT',
  interval: '15m',
  candleCount: 96,           // 96 × 15m = 24 hours
  refreshIntervalMs: 60000,  // Auto-refresh every 60 seconds
  emaPeriods: { fast: 9, slow: 21 },
  rsiPeriod: 14,
  bbPeriod: 20,
  bbMult: 2,
  atrPeriod: 14,
};

export const BINANCE_BASE = 'https://api.binance.com/api/v3';

export const COLORS = {
  green: '#00ff88',
  red: '#ff3b5c',
  blue: '#58a6ff',
  yellow: '#ffd866',
  purple: '#bc8cff',
  orange: '#ff9e64',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textDim: '#484f58',
  bgPrimary: '#06090f',
  bgSecondary: '#0d1117',
  bgTertiary: '#161b22',
  border: '#21262d',
};

export function fmt(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtTime(ts) {
  const d = new Date(ts);
  return d.getUTCHours().toString().padStart(2, '0') + ':' +
         d.getUTCMinutes().toString().padStart(2, '0');
}
