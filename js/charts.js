// charts.js — ECharts rendering for main candlestick chart and RSI subchart

import { fmtTime, fmt, COLORS } from './config.js';

let mainChart = null;
let rsiChart = null;
let depthChart = null;
let heatmapChart = null;

/**
 * Initialize or get the main chart instance
 */
function getMainChart() {
  if (!mainChart) {
    const dom = document.getElementById('main-chart');
    mainChart = echarts.init(dom, null, { renderer: 'svg' });
    window.addEventListener('resize', () => mainChart.resize());
  }
  return mainChart;
}

function getRsiChart() {
  if (!rsiChart) {
    const dom = document.getElementById('rsi-chart');
    rsiChart = echarts.init(dom, null, { renderer: 'svg' });
    window.addEventListener('resize', () => rsiChart.resize());
  }
  return rsiChart;
}

/**
 * Render the main candlestick chart with all overlays
 */
export function renderMainChart({ klines, categories, ema9, ema21, vwap, bb, orbHigh, orbLow, signals, highs, lows }) {
  const chart = getMainChart();

  // ECharts candlestick format: [open, close, low, high]
  const candleData = klines.map(k => [k[1], k[4], k[3], k[2]]);
  const volumeData = klines.map(k => ({
    value: k[5],
    itemStyle: { color: k[4] >= k[1] ? 'rgba(0,255,136,0.3)' : 'rgba(255,59,92,0.3)' }
  }));

  // Signal markers on the chart
  const markPoints = signals.map(s => ({
    coord: [categories[s.idx], s.type === 'bullish' ? lows[s.idx] - 80 : highs[s.idx] + 80],
    symbol: s.type === 'bullish' ? 'triangle' : 'pin',
    symbolSize: 14,
    symbolRotate: s.type === 'bearish' ? 180 : 0,
    itemStyle: { color: s.type === 'bullish' ? COLORS.green : COLORS.red },
    label: { show: false }
  }));

  const option = {
    backgroundColor: 'transparent',
    animation: false, // disable for fast updates
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#484f58' } },
      backgroundColor: '#161b22',
      borderColor: '#21262d',
      textStyle: { color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 },
      formatter(params) {
        const idx = params[0]?.dataIndex;
        if (idx === undefined) return '';
        const k = klines[idx];
        let s = `<div style="font-weight:600;margin-bottom:6px">${fmtTime(k[0])} UTC</div>`;
        s += `O: <span style="color:#e6edf3">$${fmt(k[1])}</span><br/>`;
        s += `H: <span style="color:${COLORS.green}">$${fmt(k[2])}</span><br/>`;
        s += `L: <span style="color:${COLORS.red}">$${fmt(k[3])}</span><br/>`;
        s += `C: <span style="color:${COLORS.blue}">$${fmt(k[4])}</span><br/>`;
        s += `Vol: <span style="color:${COLORS.yellow}">${k[5].toFixed(2)}</span><br/>`;
        if (vwap[idx]) s += `VWAP: <span style="color:${COLORS.yellow}">$${fmt(vwap[idx])}</span><br/>`;
        if (ema9[idx]) s += `EMA9: <span style="color:${COLORS.blue}">$${fmt(ema9[idx])}</span><br/>`;
        if (ema21[idx]) s += `EMA21: <span style="color:${COLORS.purple}">$${fmt(ema21[idx])}</span>`;
        return s;
      }
    },
    axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
    grid: [
      { left: 60, right: 20, top: 20, bottom: '28%' },
      { left: 60, right: 20, top: '76%', bottom: 30 }
    ],
    xAxis: [
      { type: 'category', data: categories, gridIndex: 0, axisLine: { lineStyle: { color: '#21262d' } }, axisLabel: { color: '#484f58', fontSize: 10, fontFamily: 'JetBrains Mono' }, splitLine: { show: false } },
      { type: 'category', data: categories, gridIndex: 1, axisLine: { lineStyle: { color: '#21262d' } }, axisLabel: { show: false }, splitLine: { show: false } }
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, position: 'left', axisLine: { lineStyle: { color: '#21262d' } }, axisLabel: { color: '#484f58', fontSize: 10, fontFamily: 'JetBrains Mono', formatter: v => '$' + (v / 1000).toFixed(1) + 'k' }, splitLine: { lineStyle: { color: '#161b22' } }, scale: true },
      { type: 'value', gridIndex: 1, axisLine: { lineStyle: { color: '#21262d' } }, axisLabel: { color: '#484f58', fontSize: 9, fontFamily: 'JetBrains Mono' }, splitLine: { show: false }, scale: true }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 30, end: 100 },
      { type: 'slider', xAxisIndex: [0, 1], bottom: 4, height: 18, borderColor: '#21262d', backgroundColor: '#0d1117', fillerColor: 'rgba(88,166,255,0.08)', handleStyle: { color: '#58a6ff' }, textStyle: { color: '#484f58', fontSize: 9 }, start: 30, end: 100 }
    ],
    series: [
      {
        name: 'Candles', type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0,
        data: candleData,
        itemStyle: { color: COLORS.green, color0: COLORS.red, borderColor: COLORS.green, borderColor0: COLORS.red },
        markPoint: { data: markPoints, animation: false },
        markArea: {
          silent: true,
          data: [[
            { yAxis: orbHigh, itemStyle: { color: 'rgba(255,158,100,0.06)', borderColor: 'rgba(255,158,100,0.2)', borderWidth: 1, borderType: 'dashed' } },
            { yAxis: orbLow }
          ]]
        }
      },
      { name: 'EMA9', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: ema9.map(v => v.toFixed(2)), lineStyle: { color: COLORS.blue, width: 1.5 }, symbol: 'none', smooth: true, z: 2 },
      { name: 'EMA21', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: ema21.map(v => v.toFixed(2)), lineStyle: { color: COLORS.purple, width: 1.5 }, symbol: 'none', smooth: true, z: 2 },
      { name: 'VWAP', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: vwap.map(v => v.toFixed(2)), lineStyle: { color: COLORS.yellow, width: 2, type: 'dashed' }, symbol: 'none', smooth: true, z: 3 },
      { name: 'BB Upper', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: bb.upper.map(v => v ? v.toFixed(2) : null), lineStyle: { color: 'rgba(88,166,255,0.3)', width: 1 }, symbol: 'none', smooth: true, z: 1 },
      { name: 'BB Lower', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: bb.lower.map(v => v ? v.toFixed(2) : null), lineStyle: { color: 'rgba(88,166,255,0.3)', width: 1 }, areaStyle: { color: 'rgba(88,166,255,0.04)' }, symbol: 'none', smooth: true, z: 1 },
      { name: 'ORB High', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: categories.map(() => orbHigh.toFixed(2)), lineStyle: { color: COLORS.orange, width: 1, type: 'dotted' }, symbol: 'none', z: 1 },
      { name: 'ORB Low', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: categories.map(() => orbLow.toFixed(2)), lineStyle: { color: COLORS.orange, width: 1, type: 'dotted' }, symbol: 'none', z: 1 },
      { name: 'Volume', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volumeData, barWidth: '60%' }
    ]
  };

  chart.setOption(option, true); // true = notMerge for clean update
}

/**
 * Render the RSI subchart
 */
export function renderRsiChart({ categories, rsi }) {
  const chart = getRsiChart();

  const option = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b22',
      borderColor: '#21262d',
      textStyle: { color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 },
      formatter: p => `${p[0].axisValue} — RSI: ${p[0].value ?? 'N/A'}`
    },
    grid: { left: 40, right: 10, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: categories, axisLine: { lineStyle: { color: '#21262d' } }, axisLabel: { color: '#484f58', fontSize: 9, fontFamily: 'JetBrains Mono', interval: 15 }, splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max: 100, axisLine: { lineStyle: { color: '#21262d' } }, axisLabel: { color: '#484f58', fontSize: 9, fontFamily: 'JetBrains Mono' }, splitLine: { lineStyle: { color: '#161b22' } } },
    visualMap: {
      show: false, dimension: 1, pieces: [
        { lte: 30, color: COLORS.green },
        { gt: 30, lte: 70, color: COLORS.blue },
        { gt: 70, color: COLORS.red }
      ]
    },
    series: [{
      type: 'line',
      data: rsi.map(v => v != null ? parseFloat(v.toFixed(2)) : null),
      lineStyle: { width: 2 }, symbol: 'none', smooth: true,
      areaStyle: { color: 'rgba(88,166,255,0.05)' },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { type: 'dashed', width: 1 },
        data: [
          { yAxis: 70, lineStyle: { color: 'rgba(255,59,92,0.4)' }, label: { formatter: '70', color: COLORS.red, fontSize: 9 } },
          { yAxis: 30, lineStyle: { color: 'rgba(0,255,136,0.4)' }, label: { formatter: '30', color: COLORS.green, fontSize: 9 } },
          { yAxis: 50, lineStyle: { color: 'rgba(72,79,88,0.3)' }, label: { show: false } }
        ]
      }
    }]
  };

  chart.setOption(option, true);
}

// ─── Depth Chart ───

function getDepthChart() {
  const dom = document.getElementById('depth-chart');
  if (!dom || dom.clientWidth === 0) return null;
  if (depthChart) {
    depthChart.resize();
    return depthChart;
  }
  depthChart = echarts.init(dom, null, { renderer: 'svg' });
  window.addEventListener('resize', () => depthChart && depthChart.resize());
  return depthChart;
}

/**
 * Render order book depth chart (cumulative bid/ask volume)
 */
export function renderDepthChart({ bidDepth, askDepth, midPrice }) {
  const chart = getDepthChart();
  if (!chart) return;

  // Reverse bids so price goes low→high
  const bidData = bidDepth.slice().reverse();

  const option = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b22',
      borderColor: '#21262d',
      textStyle: { color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 },
      formatter(params) {
        const p = params[0];
        if (!p) return '';
        return `Price: $${fmt(p.value[0])}<br/>Cumulative: ${p.value[1].toFixed(3)} BTC<br/><span style="color:${p.seriesName === 'Bids' ? COLORS.green : COLORS.red}">${p.seriesName}</span>`;
      }
    },
    grid: { left: 50, right: 50, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      min: midPrice * 0.98,
      max: midPrice * 1.02,
      axisLine: { lineStyle: { color: '#21262d' } },
      axisLabel: { color: '#484f58', fontSize: 9, fontFamily: 'JetBrains Mono', formatter: v => '$' + fmt(v) },
      splitLine: { lineStyle: { color: '#161b22' } },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#21262d' } },
      axisLabel: { color: '#484f58', fontSize: 9, fontFamily: 'JetBrains Mono' },
      splitLine: { lineStyle: { color: '#161b22' } },
    },
    series: [
      {
        name: 'Bids',
        type: 'line',
        data: bidData,
        step: 'end',
        lineStyle: { color: COLORS.green, width: 1.5 },
        areaStyle: { color: 'rgba(0,255,136,0.08)' },
        symbol: 'none',
      },
      {
        name: 'Asks',
        type: 'line',
        data: askDepth,
        step: 'start',
        lineStyle: { color: COLORS.red, width: 1.5 },
        areaStyle: { color: 'rgba(255,59,92,0.08)' },
        symbol: 'none',
      },
      {
        // Mid price marker
        type: 'line',
        data: [[midPrice, 0]],
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: COLORS.yellow, type: 'dashed', width: 1 },
          data: [{ xAxis: midPrice, label: { formatter: 'Mid', color: COLORS.yellow, fontSize: 9, fontFamily: 'JetBrains Mono' } }]
        }
      }
    ]
  };

  chart.setOption(option, true);
}

// ─── Heatmap Chart ───

function getHeatmapChart() {
  const dom = document.getElementById('heatmap-chart');
  if (!dom || dom.clientWidth === 0) return null;
  if (heatmapChart) {
    heatmapChart.resize();
    return heatmapChart;
  }
  heatmapChart = echarts.init(dom, null, { renderer: 'svg' });
  window.addEventListener('resize', () => heatmapChart && heatmapChart.resize());
  return heatmapChart;
}

/**
 * Render order book heatmap — horizontal bar chart with volume intensity
 */
export function renderHeatmapChart({ bins, maxVol, midPrice }) {
  const chart = getHeatmapChart();
  if (!chart) return;

  // Sort bins by price
  const sorted = bins.slice().sort((a, b) => a.price - b.price);

  const prices = sorted.map(b => '$' + fmt(b.price));
  const barData = sorted.map(b => ({
    value: b.vol,
    itemStyle: {
      color: b.side === 'bid'
        ? `rgba(0,255,136,${0.15 + 0.85 * (b.vol / maxVol)})`
        : `rgba(255,59,92,${0.15 + 0.85 * (b.vol / maxVol)})`
    }
  }));

  const option = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b22',
      borderColor: '#21262d',
      textStyle: { color: '#e6edf3', fontFamily: 'JetBrains Mono', fontSize: 11 },
      formatter(params) {
        const p = params[0];
        if (!p) return '';
        const bin = sorted[p.dataIndex];
        return `${p.name}<br/>Volume: ${p.value.toFixed(3)} BTC<br/><span style="color:${bin.side === 'bid' ? COLORS.green : COLORS.red}">${bin.side === 'bid' ? 'Bid' : 'Ask'}</span>`;
      }
    },
    grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#21262d' } },
      axisLabel: { color: '#484f58', fontSize: 9, fontFamily: 'JetBrains Mono' },
      splitLine: { lineStyle: { color: '#161b22' } },
    },
    yAxis: {
      type: 'category',
      data: prices,
      axisLine: { lineStyle: { color: '#21262d' } },
      axisLabel: { color: '#484f58', fontSize: 8, fontFamily: 'JetBrains Mono', interval: Math.max(0, Math.floor(prices.length / 20) - 1) },
      splitLine: { show: false },
    },
    series: [{
      type: 'bar',
      data: barData,
      barWidth: '80%',
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: COLORS.yellow, type: 'dashed', width: 1 },
        data: [{ yAxis: '$' + fmt(midPrice), label: { formatter: 'Mid', color: COLORS.yellow, fontSize: 9 } }]
      }
    }]
  };

  chart.setOption(option, true);
}
