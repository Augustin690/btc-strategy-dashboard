# BTC/USDT Strategy Dashboard

Live trading strategy dashboard for BTC/USDT tracking three intraday strategies with auto-refresh from the Binance public API.

Check it out at: https://augustin690.github.io/btc-strategy-dashboard/ / https://mlrc3lu3.mule.page/

<img width="1768" height="1311" alt="screenshot1" src="https://github.com/user-attachments/assets/9738dd14-3cb3-4192-904b-60b5f0a5b257" />

## Strategies

- **Opening Range Breakout (ORB)** — Detects breakouts above/below the first 15m candle's high/low
- **VWAP Reclaim** — Tracks price reclaiming or losing the Volume-Weighted Average Price
- **EMA Crossover** — Monitors EMA 9/21 golden cross and death cross signals

## Features

- Real-time data from Binance REST API (no API key required)
- 96 x 15-minute candles (24-hour window)
- 60-second auto-refresh with countdown
- Interactive candlestick chart with EMA, VWAP, Bollinger Bands overlays
- RSI subchart with overbought/oversold zones
- MACD-based multi-timeframe verdict (15m + 1h alignment)
- Dynamic support/resistance from swing high/low detection
- Signal log scanning all candles for crossover events

## Tech Stack

- **ECharts** (v5.5.0, SVG renderer) — Charting
- **TailwindCSS** (CDN) — Styling
- **ES Modules** — Modular JavaScript architecture
- **Binance REST API** — Live market data

## Architecture

```
index.html          # Markup + CSS shell (zero inline JS)
js/
  config.js         # Constants, colors, formatting helpers
  data.js           # Binance API data fetching
  indicators.js     # EMA, VWAP, BB, RSI, ATR, MACD computation
  strategies.js     # ORB, VWAP Reclaim, EMA Cross detection
  charts.js         # ECharts candlestick + RSI rendering
  ui.js             # DOM updates, badges, strategy panels
  app.js            # Orchestration + 60s auto-refresh loop
```

## Usage

Serve the files with any static HTTP server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# Or open index.html via any local dev server (ES modules require HTTP)
```

Then open `http://localhost:8080` in your browser.

> **Note:** ES modules require serving over HTTP — opening `index.html` directly via `file://` will not work due to CORS restrictions.

## License

MIT
