// ui.js — DOM updates, badges, metric rows, strategy panels, signal log

import { fmt } from './config.js';

// ─── Helpers ───

function metricRow(label, value, color) {
  return `<div class="flex justify-between items-center">
    <span class="text-xs text-[#8b949e]">${label}</span>
    <span class="mono text-sm font-semibold" style="color:${color || '#e6edf3'}">${value}</span>
  </div>`;
}

function setBadge(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'badge badge-' + (type === 'bullish' ? 'bull' : type === 'bearish' ? 'bear' : 'neutral');
}

// ─── Header ───

export function updateTimestamp() {
  const el = document.getElementById('timestamp');
  if (el) el.textContent = new Date().toUTCString().replace('GMT', 'UTC');
}

export function updateRefreshCountdown(seconds) {
  const el = document.getElementById('refresh-countdown');
  if (el) el.textContent = `${seconds}s`;
}

// ─── Metrics Row ───

export function updateMetrics({ ticker, rsiValue, atrValue, atrPct, ema9, ema21, macd }) {
  const priceEl = document.getElementById('m-price');
  const changeEl = document.getElementById('m-change');
  const rangeLow = document.getElementById('range-low');
  const rangeHigh = document.getElementById('range-high');
  const rangeBar = document.getElementById('range-bar');
  const rsiVal = document.getElementById('rsi-value');
  const rsiBadge = document.getElementById('rsi-badge');
  const atrVal = document.getElementById('atr-value');
  const atrPctEl = document.getElementById('atr-pct');
  const emaVal = document.getElementById('ema-values');
  const emaBadge = document.getElementById('ema-metric-badge');
  const macdVal = document.getElementById('macd-value');
  const macdSig = document.getElementById('macd-signal');
  const macdBadge = document.getElementById('macd-badge');

  if (priceEl) priceEl.textContent = '$' + fmt(ticker.last);
  if (changeEl) {
    const positive = ticker.changePct >= 0;
    changeEl.textContent = (positive ? '+' : '') + ticker.changePct.toFixed(2) + '%';
    changeEl.style.color = positive ? 'var(--accent-green)' : 'var(--accent-red)';
  }
  if (rangeLow) rangeLow.textContent = '$' + fmt(ticker.low);
  if (rangeHigh) rangeHigh.textContent = '$' + fmt(ticker.high);
  if (rangeBar) {
    const pct = ((ticker.last - ticker.low) / (ticker.high - ticker.low) * 100).toFixed(0);
    rangeBar.style.width = pct + '%';
  }
  if (rsiVal) rsiVal.textContent = rsiValue != null ? rsiValue.toFixed(1) : '--';
  if (rsiBadge) {
    rsiBadge.textContent = rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral';
    rsiBadge.className = 'badge ' + (rsiValue > 70 ? 'badge-bear' : rsiValue < 30 ? 'badge-bull' : 'badge-neutral');
  }
  if (atrVal) atrVal.textContent = '$' + (atrValue != null ? Math.round(atrValue) : '--');
  if (atrPctEl) atrPctEl.textContent = (atrPct != null ? atrPct.toFixed(2) : '--') + '% volatility';
  if (emaVal) emaVal.innerHTML = `${fmt(ema9)} <span class="text-[#484f58]">/</span> ${fmt(ema21)}`;
  if (emaBadge) {
    emaBadge.textContent = ema9 > ema21 ? '9 > 21' : '9 < 21';
    emaBadge.className = 'badge ' + (ema9 > ema21 ? 'badge-bull' : 'badge-bear');
  }
  if (macdVal) {
    macdVal.textContent = macd.macd.toFixed(2);
    macdVal.style.color = macd.macd >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  }
  if (macdSig) macdSig.textContent = 'Sig: ' + macd.signal.toFixed(2);
  if (macdBadge) {
    const cross = macd.macd > macd.signal ? 'Golden Cross' : 'Death Cross';
    macdBadge.textContent = cross;
    macdBadge.className = 'badge ' + (macd.macd > macd.signal ? 'badge-bull' : 'badge-bear');
  }
}

// ─── Strategy Panels ───

export function updateORBPanel(orb, currentPrice) {
  setBadge('orb-badge', orb.status, orb.signal);
  const el = document.getElementById('orb-details');
  if (!el) return;

  let entry;
  if (currentPrice > orb.orbHigh) {
    entry = `Long above $${fmt(orb.orbHigh)} — Target: $${fmt(orb.orbHigh + (orb.orbHigh - orb.orbLow))} — Stop: $${fmt(orb.orbMid)}`;
  } else if (currentPrice < orb.orbLow) {
    entry = `Short below $${fmt(orb.orbLow)} — Target: $${fmt(orb.orbLow - (orb.orbHigh - orb.orbLow))} — Stop: $${fmt(orb.orbMid)}`;
  } else {
    entry = `Wait for breakout above $${fmt(orb.orbHigh)} or below $${fmt(orb.orbLow)}`;
  }

  el.innerHTML =
    metricRow('ORB High', '$' + fmt(orb.orbHigh), 'var(--accent-green)') +
    metricRow('ORB Low', '$' + fmt(orb.orbLow), 'var(--accent-red)') +
    metricRow('ORB Mid', '$' + fmt(orb.orbMid), 'var(--accent-yellow)') +
    metricRow('Range Width', '$' + fmt(orb.orbHigh - orb.orbLow)) +
    '<div class="divider"></div>' +
    metricRow('Current Price', '$' + fmt(currentPrice), orb.color) +
    metricRow('Dist. to High', (currentPrice > orb.orbHigh ? '+' : '') + fmt(currentPrice - orb.orbHigh),
      currentPrice > orb.orbHigh ? 'var(--accent-green)' : 'var(--accent-red)') +
    metricRow('Dist. to Low', (currentPrice > orb.orbLow ? '+' : '') + fmt(currentPrice - orb.orbLow),
      currentPrice > orb.orbLow ? 'var(--accent-green)' : 'var(--accent-red)') +
    '<div class="divider"></div>' +
    `<div class="p-2 rounded" style="background:var(--bg-tertiary)">
      <div class="text-xs text-[#8b949e] mb-1">Suggested Entry</div>
      <div class="text-xs" style="color:${orb.color}">${entry}</div>
    </div>`;
}

export function updateVWAPPanel(vwapState, currentPrice, prevClose, vwapCurrent, vwapPrev) {
  setBadge('vwap-badge', vwapState.status, vwapState.signal);
  const el = document.getElementById('vwap-details');
  if (!el) return;

  const note = vwapState.signal === 'bullish'
    ? 'Price holding above VWAP — look for long entries on pullbacks to VWAP with tight stops below.'
    : 'Price below VWAP — bearish bias. Short rallies into VWAP with stops above.';

  el.innerHTML =
    metricRow('VWAP Value', '$' + fmt(vwapCurrent), 'var(--accent-yellow)') +
    metricRow('Price vs VWAP', (currentPrice > vwapCurrent ? '+' : '') + fmt(currentPrice - vwapCurrent),
      currentPrice > vwapCurrent ? 'var(--accent-green)' : 'var(--accent-red)') +
    metricRow('VWAP Deviation', ((currentPrice - vwapCurrent) / vwapCurrent * 100).toFixed(3) + '%') +
    '<div class="divider"></div>' +
    metricRow('Prev Close', '$' + fmt(prevClose)) +
    metricRow('Prev vs VWAP', prevClose > vwapPrev ? 'Above' : 'Below',
      prevClose > vwapPrev ? 'var(--accent-green)' : 'var(--accent-red)') +
    '<div class="divider"></div>' +
    `<div class="p-2 rounded" style="background:var(--bg-tertiary)">
      <div class="text-xs text-[#8b949e] mb-1">Strategy Note</div>
      <div class="text-xs" style="color:${vwapState.color}">${note}</div>
    </div>`;
}

export function updateEMAPanel(emaState, currentPrice, ema9Now, ema21Now) {
  setBadge('ema-badge', emaState.status, emaState.signal);
  const el = document.getElementById('ema-details');
  if (!el) return;

  const note = emaState.signal === 'bullish'
    ? 'EMA9 above EMA21 — bullish momentum. Enter longs on pullbacks to EMA9.'
    : 'EMA9 below EMA21 — bearish momentum. Favor shorts on rallies to EMA9.';

  el.innerHTML =
    metricRow('EMA 9', '$' + fmt(ema9Now), 'var(--accent-blue)') +
    metricRow('EMA 21', '$' + fmt(ema21Now), 'var(--accent-purple)') +
    metricRow('EMA Spread', '$' + fmt(Math.abs(ema9Now - ema21Now))) +
    metricRow('Spread %', ((ema9Now - ema21Now) / ema21Now * 100).toFixed(3) + '%',
      ema9Now > ema21Now ? 'var(--accent-green)' : 'var(--accent-red)') +
    '<div class="divider"></div>' +
    metricRow('Price vs EMA9', currentPrice > ema9Now ? 'Above' : 'Below',
      currentPrice > ema9Now ? 'var(--accent-green)' : 'var(--accent-red)') +
    metricRow('Price vs EMA21', currentPrice > ema21Now ? 'Above' : 'Below',
      currentPrice > ema21Now ? 'var(--accent-green)' : 'var(--accent-red)') +
    '<div class="divider"></div>' +
    `<div class="p-2 rounded" style="background:var(--bg-tertiary)">
      <div class="text-xs text-[#8b949e] mb-1">Strategy Note</div>
      <div class="text-xs" style="color:${emaState.color}">${note}</div>
    </div>`;
}

// ─── Signal Log ───

export function updateSignalLog(signals) {
  const logEl = document.getElementById('signal-log');
  if (!logEl) return;

  if (signals.length === 0) {
    logEl.innerHTML = '<div class="text-xs text-[#484f58] text-center py-8">No crossover signals in current 24h window</div>';
    return;
  }

  const stratColors = { ORB: '#ff9e64', VWAP: '#ffd866', EMA: '#bc8cff' };
  const typeColors = { bullish: 'var(--accent-green)', bearish: 'var(--accent-red)', neutral: 'var(--accent-blue)' };

  logEl.innerHTML = signals.slice().reverse().map(s =>
    `<div class="signal-row ${s.type}">
      <span class="mono text-xs text-[#484f58] w-12 shrink-0">${s.time}</span>
      <span class="badge" style="background:${stratColors[s.strategy]}22;color:${stratColors[s.strategy]};font-size:10px">${s.strategy}</span>
      <span class="text-xs" style="color:${typeColors[s.type]}">${s.msg}</span>
    </div>`
  ).join('');
}

// ─── Multi-TF Verdict ───

export function updateVerdict(macd15m, macd1h) {
  // The 15m/1h verdicts are based on the latest MACD cross direction
  const tf15m = document.getElementById('verdict-15m');
  const tf1h = document.getElementById('verdict-1h');
  const composite = document.getElementById('verdict-composite');

  const is15mBull = macd15m.macd > macd15m.signal;
  const is1hBull = macd1h.macd > macd1h.signal;

  if (tf15m) {
    tf15m.className = 'signal-row ' + (is15mBull ? 'bullish' : 'bearish');
    tf15m.innerHTML = `
      <div class="flex-1">
        <div class="text-xs text-[#8b949e]">15m Timeframe</div>
        <div class="text-sm font-semibold text-white mt-1">${is15mBull ? 'Bullish' : 'Bearish'}</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-[#8b949e]">MACD ${is15mBull ? 'Golden' : 'Death'} Cross</div>
        <div class="text-xs mono mt-1" style="color:var(--accent-${is15mBull ? 'green' : 'red'})">${is15mBull ? '1' : '0'} Bull / ${is15mBull ? '0' : '1'} Bear</div>
      </div>`;
  }

  if (tf1h) {
    tf1h.className = 'signal-row ' + (is1hBull ? 'bullish' : 'bearish');
    tf1h.innerHTML = `
      <div class="flex-1">
        <div class="text-xs text-[#8b949e]">1h Timeframe</div>
        <div class="text-sm font-semibold text-white mt-1">${is1hBull ? 'Bullish' : 'Bearish'}</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-[#8b949e]">MACD ${is1hBull ? 'Golden' : 'Death'} Cross</div>
        <div class="text-xs mono mt-1" style="color:var(--accent-${is1hBull ? 'green' : 'red'})">${is1hBull ? '1' : '0'} Bull / ${is1hBull ? '0' : '1'} Bear</div>
      </div>`;
  }

  if (composite) {
    const agree = is15mBull === is1hBull;
    const dir = agree ? (is15mBull ? 'bullish' : 'bearish') : 'neutral';
    composite.className = 'signal-row ' + dir;
    composite.innerHTML = `
      <div class="flex-1">
        <div class="text-xs text-[#8b949e]">Composite</div>
        <div class="text-sm font-semibold text-white mt-1">${agree ? (is15mBull ? 'Bullish' : 'Bearish') : 'Mixed / Neutral'}</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-[#8b949e]">${agree ? 'Aligned signals' : 'Conflicting signals'}</div>
        <div class="badge badge-${dir === 'bullish' ? 'bull' : dir === 'bearish' ? 'bear' : 'neutral'} mt-1">${agree ? (is15mBull ? 'Go Long' : 'Go Short') : 'Caution'}</div>
      </div>`;
  }
}

// ─── Key Levels ───

export function updateKeyLevels(supports, resistances) {
  const el = document.getElementById('key-levels');
  if (!el) return;

  const s = supports.slice(0, 3);
  const r = resistances.slice(0, 3);

  let html = '';
  for (let i = 0; i < 3; i++) {
    html += `<div><span class="text-[#8b949e]">S${i + 1}:</span> <span class="text-[#00ff88]">${s[i] != null ? '$' + fmt(s[i]) : '--'}</span></div>`;
    html += `<div><span class="text-[#8b949e]">R${i + 1}:</span> <span class="text-[#ff3b5c]">${r[i] != null ? '$' + fmt(r[i]) : '--'}</span></div>`;
  }
  el.innerHTML = html;
}

// ─── Loading / Error State ───

export function showStatus(msg, isError = false) {
  const el = document.getElementById('status-bar');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--accent-red)' : 'var(--accent-blue)';
  el.style.display = msg ? 'block' : 'none';
}
