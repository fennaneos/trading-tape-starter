// server/routes/strategy.js
import express from 'express';

const router = express.Router();

/** --------- Helpers (pure) --------- */
function ema(values, period) {
  if (!values?.length || period <= 0) return [];
  const k = 2 / (period + 1);
  const out = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}

function crossover(prevA, prevB, a, b) {
  // +1 = cross up (A goes above B), -1 = cross down, 0 = nothing
  const wasAbove = prevA > prevB;
  const isAbove = a > b;
  if (!wasAbove && isAbove) return +1;
  if (wasAbove && !isAbove) return -1;
  return 0;
}

/**
 * Simple backtest:
 * - Long only on fastEMA cross above slowEMA
 * - Exit on cross below
 * - Equity evolves by percentage return between entry/exit closes
 * - No commissions/slippage (keep v1 simple)
 */
function backtestEMACross(candles, fast = 12, slow = 26, capital = 10000) {
  const closes = candles.map(c => c.c);
  const f = ema(closes, fast);
  const s = ema(closes, slow);

  let equity = capital;
  const equityCurve = [];
  const trades = [];
  const signals = []; // for plotting (t, price, signal)

  let inPos = false;
  let entryPx = 0;
  let entryT = 0;

  for (let i = 1; i < candles.length; i++) {
    const prev = crossover(f[i - 1], s[i - 1], f[i], s[i]);
    const t = candles[i].t;
    const px = closes[i];

    // Record equity point (mark-to-market; simple: flat unless in trade we mark at px)
    equityCurve.push({ t, equity });

    if (prev === +1) {
      // cross up → buy (if flat)
      if (!inPos) {
        inPos = true;
        entryPx = px;
        entryT = t;
        signals.push({ t, price: px, signal: 'buy' });
      }
    } else if (prev === -1) {
      // cross down → sell (if long)
      if (inPos) {
        const ret = (px - entryPx) / entryPx; // pct
        const pnl = equity * ret;             // use full capital for v1
        equity += pnl;
        trades.push({
          side: 'long',
          entryT,
          entryPx,
          exitT: t,
          exitPx: px,
          ret,
          pnl,
          equityAfter: equity,
        });
        inPos = false;
        entryPx = 0;
        entryT = 0;
        signals.push({ t, price: px, signal: 'sell' });
      }
    }
  }

  // Close any open position at last close
  const last = candles[candles.length - 1];
  if (inPos && last) {
    const px = last.c;
    const ret = (px - entryPx) / entryPx;
    const pnl = equity * ret;
    equity += pnl;
    trades.push({
      side: 'long',
      entryT,
      entryPx,
      exitT: last.t,
      exitPx: px,
      ret,
      pnl,
      equityAfter: equity,
    });
    signals.push({ t: last.t, price: px, signal: 'sell' });
  }

  // Metrics
  const totalReturn = (equity - capital) / capital;
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length ? wins / trades.length : 0;

  // Max drawdown on equity curve
  let peak = capital;
  let maxDD = 0;
  for (const pt of equityCurve) {
    peak = Math.max(peak, pt.equity);
    maxDD = Math.max(maxDD, (peak - pt.equity) / peak);
  }

  return {
    metrics: {
      startCapital: capital,
      endCapital: equity,
      totalReturn,
      winRate,
      trades: trades.length,
      maxDrawdown: maxDD,
      fast,
      slow,
    },
    equity: equityCurve,
    trades,
    signals,
  };
}

/** --------- Route --------- */
/**
 * POST /api/strategy/backtest
 * body: { candles: [{t,o,h,l,c,v}], fast?:number, slow?:number, capital?:number }
 */
router.post('/backtest', (req, res) => {
  try {
    const { candles, fast = 12, slow = 26, capital = 10000 } = req.body || {};
    if (!Array.isArray(candles) || candles.length < Math.max(fast, slow) + 5) {
      return res.status(400).json({ error: 'need candles[] with sufficient length' });
    }
    const result = backtestEMACross(candles, Number(fast), Number(slow), Number(capital));
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'backtest_failed' });
  }
});

export default router;
