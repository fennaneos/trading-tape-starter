// server/routes/backtest.js
import express from 'express';

// --- tiny helpers ---
function ema(series, period) {
  if (!series?.length || period <= 0) return [];
  const k = 2 / (period + 1);
  const out = new Array(series.length);
  out[0] = series[0];
  for (let i = 1; i < series.length; i++) out[i] = series[i] * k + out[i - 1] * (1 - k);
  return out;
}

// Make some candles if provider fails
function mockCandles(n = 300, start = 1.1) {
  const arr = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    const noise = (Math.random() - 0.5) * 0.004;
    p = Math.max(0.5, p * (1 + noise));
    const o = p * (1 + (Math.random() - 0.5) * 0.002);
    const h = Math.max(o, p) * (1 + Math.random() * 0.0015);
    const l = Math.min(o, p) * (1 - Math.random() * 0.0015);
    const c = p;
    const v = 100 + Math.random() * 50;
    arr.push({ t: Date.now() - (n - i) * 60_000, o, h, l, c, v });
  }
  return arr;
}

const router = express.Router();

/**
 * GET /api/backtest/ema?symbol=EURUSD&tf=1m&fast=12&slow=26&limit=500
 * Returns: { curve: [{t,equity}], stats: { ret, trades } }
 */
router.get('/ema', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || 'EURUSD').toUpperCase();
    const tf = String(req.query.tf || '1m');
    const fast = Math.max(2, parseInt(req.query.fast || '12', 10));
    const slow = Math.max(fast + 1, parseInt(req.query.slow || '26', 10));
    const limit = Math.max(120, Math.min(2000, parseInt(req.query.limit || '500', 10)));

    // Try to use your existing candles endpoint (same server), else mock
    let candles = [];
    try {
      const base = process.env.SELF_BASE || `http://localhost:${process.env.PORT || 4000}`;
      const url = `${base}/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=${limit}`;
      const r = await fetch(url);
      if (r.ok) candles = await r.json();
    } catch (_) {}

    if (!Array.isArray(candles) || candles.length < 50) {
      candles = mockCandles(limit, 1.1);
    }

    const closes = candles.map(c => c.c);
    const eFast = ema(closes, fast);
    const eSlow = ema(closes, slow);

    // Simple crossover strategy: +1 long, -1 short, 0 flat (we'll use +1/-1 only)
    let pos = 0;
    let equity = 0;
    let trades = 0;
    const curve = [];

    for (let i = 1; i < candles.length; i++) {
      const prevCross = Math.sign((eFast[i - 1] ?? closes[i - 1]) - (eSlow[i - 1] ?? closes[i - 1]));
      const currCross = Math.sign((eFast[i] ?? closes[i]) - (eSlow[i] ?? closes[i]));

      // signal on cross
      if (prevCross <= 0 && currCross > 0 && pos !== 1) {
        pos = 1; trades++;
      } else if (prevCross >= 0 && currCross < 0 && pos !== -1) {
        pos = -1; trades++;
      }

      // PnL from previous to current close with current position
      const r = (closes[i] - closes[i - 1]) / (closes[i - 1] || 1);
      equity += pos * r; // 1-unit, no fees
      curve.push({ t: candles[i].t, equity: equity * 100 }); // %*100 (so ~percentage points)
    }

    const ret = (equity * 100).toFixed ? equity * 100 : equity; // percentage points
    res.json({ curve, stats: { ret, trades } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'backtest_failed' });
  }
});

export default router;
