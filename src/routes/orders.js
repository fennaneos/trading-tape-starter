// server/routes/orders.js
import express from "express";

const router = express.Router();

// ---- Config (Paper by default) ----
const ALPACA_KEY    = process.env.ALPACA_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET || "";
const ALPACA_BASE   = process.env.ALPACA_BASE || "https://paper-api.alpaca.markets";

// Minimal symbol map helper (UI uses BTCUSD / AAPL / etc.)
function toAlpacaSymbol(sym) {
  // equities pass through, crypto pairs must use /USD and "crypto" venue
  // e.g., "BTCUSD" -> "BTC/USD"
  if (/^[A-Z]{3,5}USD$/.test(sym)) return `${sym.replace("USD", "")}/USD`;
  return sym;
}

// ---- Preview (no broker call) ----
router.post("/preview", express.json(), (req, res) => {
  const { side, type, symbol, qty, limitPrice, stopPrice } = req.body || {};
  if (!side || !symbol || !qty || qty <= 0) {
    return res.status(400).json({ error: "bad_request" });
  }
  const notional = limitPrice ? qty * limitPrice : undefined;
  return res.json({
    ok: true,
    side,
    type: type || "market",
    symbol,
    qty,
    limitPrice,
    stopPrice,
    notional,
    warnings: [],
  });
});

// ---- Place order (Alpaca) ----
// Supports market / limit; optional takeProfit/stopLoss you can extend later.
router.post("/place", express.json(), async (req, res) => {
  try {
    const {
      side,          // 'buy' | 'sell'
      type,          // 'market' | 'limit'
      symbol,        // e.g. 'AAPL' or 'BTCUSD'
      qty,           // shares or units
      limitPrice,    // for limit
      tif = "day",   // time-in-force: day, gtc, ioc, fok
      assetClass,    // 'us_equity' | 'crypto' (optional hint)
    } = req.body || {};

    if (!side || !symbol || !qty || qty <= 0) {
      return res.status(400).json({ error: "bad_request" });
    }
    if (!ALPACA_KEY || !ALPACA_SECRET) {
      return res.status(400).json({ error: "alpaca_keys_missing" });
    }

    // Decide endpoint
    const isCrypto = assetClass === "crypto" || /[A-Z]+USD$/.test(symbol);
    const alpacaSymbol = isCrypto ? toAlpacaSymbol(symbol) : symbol;

    const url = isCrypto
      ? `${ALPACA_BASE}/v2/orders`          // Alpaca uses same /v2/orders for crypto & equities now
      : `${ALPACA_BASE}/v2/orders`;

    const payload = {
      symbol: alpacaSymbol,
      side,                       // buy/sell
      type: type || "market",     // market/limit/stop/stop_limit/etc.
      qty: isCrypto ? undefined : String(qty), // equities require qty (string)
      notional: isCrypto ? String(qty) : undefined, // for crypto: use notional (units in USD) OR qty depending on preference
      time_in_force: tif,
    };

    if (type === "limit") payload.limit_price = String(limitPrice);

    // NOTE: If you prefer qty for crypto instead of notional, set `qty: String(qty)` and remove notional.
    // Check Alpaca docs for the exact shape you’d like to use.

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: "alpaca_error", details: json });
    }
    return res.json({ ok: true, broker: "alpaca", order: json });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "order_failed" });
  }
});

// ---- List orders (recent) ----
router.get("/", async (_req, res) => {
  try {
    if (!ALPACA_KEY || !ALPACA_SECRET)
      return res.status(400).json({ error: "alpaca_keys_missing" });

    const url = `${ALPACA_BASE}/v2/orders?status=all&limit=50&nested=true`;
    const resp = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
      },
    });
    const json = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(json);
    res.json(json);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "list_failed" });
  }
});

export default router;
