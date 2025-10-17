// src/components/TradePanel.tsx
import React, { useEffect, useMemo, useState } from "react";

type Side = "buy" | "sell";
type OrdType = "market" | "limit";
type TIF = "day" | "gtc";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000";

type Quote = {
  symbol: string;
  bid?: number;
  ask?: number;
  mid?: number;
  ts?: number;
};

type Order = {
  id: string;
  symbol: string;
  qty: string;
  side: Side;
  type: OrdType;
  status: string;
  submitted_at?: string;
  limit_price?: number;
};

type Position = {
  symbol: string;
  qty: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string; // ratio
  avg_entry_price: string;
  current_price: string;
};

function fmt(n?: number | string, d = 2) {
  if (n === undefined || n === null) return "-";
  const x = typeof n === "string" ? Number(n) : n;
  if (!isFinite(x)) return "-";
  return x.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(212,175,55,.35)",
        background: "rgba(212,175,55,.08)",
        color: "#ffd700",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function TradePanel({
  defaultSymbol = "AAPL",
}: {
  defaultSymbol?: string;
}) {
  // ---- ticket state ----
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<OrdType>("market");
  const [qty, setQty] = useState<string>("1");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [tif, setTif] = useState<TIF>("day");
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // ---- broker data ----
  const [quote, setQuote] = useState<Quote | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const palette = {
    gold: "#ffd700",
    red: "#ef4444",
    green: "#22c55e",
    dark: "#0b0f14",
    panel: "rgba(255,255,255,0.03)",
    border: "rgba(212,175,55,.25)",
  };

  // fetch quote (with demo fallback)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE}/api/broker/alpaca/quote/${encodeURIComponent(symbol)}`,
          { cache: "no-store" }
        );
        if (!r.ok) throw new Error("no broker");
        const j = await r.json();
        // Alpaca returns {symbol, quote:{bp,ap, ...}}
        const bid = j.quote?.bp ?? undefined;
        const ask = j.quote?.ap ?? undefined;
        const mid =
          bid && ask ? (Number(bid) + Number(ask)) / 2 : (bid ?? ask ?? undefined);
        if (alive)
          setQuote({
            symbol,
            bid: bid ? Number(bid) : undefined,
            ask: ask ? Number(ask) : undefined,
            mid: mid ? Number(mid) : undefined,
            ts: Date.now(),
          });
      } catch {
        // demo fallback
        const base = symbol.toUpperCase().charCodeAt(0) % 90;
        const mid = 100 + (base % 25) + Math.random() * 3;
        if (alive)
          setQuote({
            symbol,
            bid: mid - 0.05,
            ask: mid + 0.05,
            mid,
            ts: Date.now(),
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [symbol]);

  // load orders & positions
  const reloadSidePanels = async () => {
    try {
      const [ro, rp] = await Promise.all([
        fetch(`${API_BASE}/api/broker/alpaca/orders`).then((r) =>
          r.ok ? r.json() : []
        ),
        fetch(`${API_BASE}/api/broker/alpaca/positions`).then((r) =>
          r.ok ? r.json() : []
        ),
      ]);
      setOrders(Array.isArray(ro) ? ro : []);
      setPositions(Array.isArray(rp) ? rp : []);
    } catch {
      // demo fallback positions/orders
      setOrders([]);
      setPositions([]);
    }
  };

  useEffect(() => {
    reloadSidePanels();
  }, []);

  const notional = useMemo(() => {
    const px =
      type === "limit"
        ? Number(limitPrice) || undefined
        : quote?.mid || quote?.ask || quote?.bid;
    const q = Number(qty) || 0;
    return px && q ? px * q : undefined;
  }, [type, limitPrice, quote, qty]);

  async function placeOrder() {
    setMsg("");
    setPlacing(true);
    try {
      const payload: any = {
        symbol,
        side,
        qty: Number(qty) || 1,
        type,
        tif,
      };
      if (type === "limit") payload.limitPrice = Number(limitPrice) || undefined;

      const r = await fetch(`${API_BASE}/api/broker/alpaca/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));
      setMsg(`Order accepted: ${j.id} (${j.status})`);
      await reloadSidePanels();
    } catch (e: any) {
      setMsg(`Order failed: ${e.message || e.toString()}`);
    } finally {
      setPlacing(false);
    }
  }

  async function cancelOrder(id: string) {
    try {
      await fetch(`${API_BASE}/api/broker/alpaca/orders/${id}`, {
        method: "DELETE",
      });
      await reloadSidePanels();
    } catch {}
  }

  const buyActive = side === "buy";
  const pxPreview =
    type === "limit"
      ? Number(limitPrice) || undefined
      : quote?.ask || quote?.mid || undefined;

  return (
    <div
      className="panel"
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 16,
        background: palette.panel,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="panelHeader"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          color: palette.gold,
          fontWeight: 800,
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        Trading — Order Ticket
        <div style={{ flex: 1 }} />
        {quote?.ts ? (
          <Pill>
            {quote.symbol} · bid {fmt(quote.bid)} / ask {fmt(quote.ask)}
          </Pill>
        ) : (
          <Pill>Demo quotes</Pill>
        )}
      </div>

      {/* Ticket body */}
      <div
        className="panelBody"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 360px) 1fr",
          gap: 14,
          padding: 12,
        }}
      >
        {/* LEFT: Ticket */}
        <div
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 14,
            padding: 12,
            background:
              "linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02))",
          }}
        >
          {/* symbol row */}
          <label style={rowLabel}>Symbol</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL / TSLA / SPY / BTCUSD"
            />
            <button
              className="gb-btn gb-outline"
              onClick={() =>
                alert(
                  "Examples:\n\nStocks/ETFs: AAPL, TSLA, MSFT, SPY\nCrypto (Alpaca): BTCUSD, ETHUSD\n"
                )
              }
            >
              Symbols
            </button>
          </div>

          {/* buy/sell */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              className="gb-btn"
              style={{
                flex: 1,
                background: buyActive ? "rgba(34,197,94,.15)" : "transparent",
                borderColor: buyActive ? "rgba(34,197,94,.45)" : palette.border,
                color: buyActive ? "#22c55e" : "#e7e7e7",
              }}
              onClick={() => setSide("buy")}
            >
              Buy
            </button>
            <button
              className="gb-btn"
              style={{
                flex: 1,
                background: !buyActive ? "rgba(239,68,68,.15)" : "transparent",
                borderColor: !buyActive ? "rgba(239,68,68,.45)" : palette.border,
                color: !buyActive ? "#ef4444" : "#e7e7e7",
              }}
              onClick={() => setSide("sell")}
            >
              Sell
            </button>
          </div>

          {/* order type + qty */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 10,
            }}
          >
            <div>
              <label style={rowLabel}>Type</label>
              <select
                className="select"
                value={type}
                onChange={(e) => setType(e.target.value as OrdType)}
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>
            <div>
              <label style={rowLabel}>Qty</label>
              <input
                className="num"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </div>

          {/* limit price + tif */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 10,
            }}
          >
            <div>
              <label style={rowLabel}>Price</label>
              <input
                className="num"
                value={limitPrice}
                disabled={type !== "limit"}
                placeholder={type === "limit" ? "Limit price" : "—"}
                onChange={(e) =>
                  setLimitPrice(e.target.value.replace(/[^\d.]/g, ""))
                }
              />
            </div>
            <div>
              <label style={rowLabel}>TIF</label>
              <select
                className="select"
                value={tif}
                onChange={(e) => setTif(e.target.value as TIF)}
              >
                <option value="day">DAY</option>
                <option value="gtc">GTC</option>
              </select>
            </div>
          </div>

          {/* preview + place */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <Pill>
              {side.toUpperCase()} {qty || 0} {symbol} @{" "}
              {fmt(pxPreview)} ≈ {fmt(notional)}
            </Pill>
            <div style={{ flex: 1 }} />
            <button
              className="gb-btn gb-solid"
              onClick={placeOrder}
              disabled={placing}
              title="Submit to broker (paper if configured)"
            >
              {placing ? "Placing…" : "Place Order"}
            </button>
          </div>

          {msg && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: msg.includes("failed") ? palette.red : palette.green,
              }}
            >
              {msg}
            </div>
          )}

          <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
            Note: paper trading is simulated. No slippage or fees here. For live,
            just switch your server env to the live Alpaca base URL.
          </div>
        </div>

        {/* RIGHT: Orders & Positions */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: "minmax(160px, auto) minmax(200px, 1fr)",
            gap: 12,
          }}
        >
          {/* Orders */}
          <div
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                color: palette.gold,
                fontWeight: 700,
              }}
            >
              Open Orders
              <div style={{ flex: 1 }} />
              <button className="gb-btn gb-outline" onClick={reloadSidePanels}>
                Refresh
              </button>
            </div>
            {orders.length === 0 ? (
              <div style={{ opacity: 0.65, fontSize: 13 }}>No open orders.</div>
            ) : (
              <div className="table-like">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "90px 60px 70px 80px 1fr auto",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: "1px dashed rgba(255,255,255,.06)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ color: palette.gold, fontWeight: 700 }}>
                      {o.symbol}
                    </div>
                    <div
                      style={{
                        color: o.side === "buy" ? palette.green : palette.red,
                      }}
                    >
                      {o.side.toUpperCase()}
                    </div>
                    <div>{o.type}</div>
                    <div>{fmt(o.limit_price)}</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>{o.status}</div>
                    <button
                      className="gb-btn gb-ghost"
                      onClick={() => cancelOrder(o.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Positions */}
          <div
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                color: palette.gold,
                fontWeight: 700,
              }}
            >
              Positions
              <div style={{ flex: 1 }} />
              <button className="gb-btn gb-outline" onClick={reloadSidePanels}>
                Refresh
              </button>
            </div>

            {positions.length === 0 ? (
              <div style={{ opacity: 0.65, fontSize: 13 }}>
                No positions yet. Place an order to open one.
              </div>
            ) : (
              <div className="table-like">
                {positions.map((p) => {
                  const pl = Number(p.unrealized_pl || 0);
                  const plpc = Number(p.unrealized_plpc || 0);
                  return (
                    <div
                      key={p.symbol}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "90px 80px 90px 90px 1fr",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px dashed rgba(255,255,255,.06)",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ color: palette.gold, fontWeight: 700 }}>
                        {p.symbol}
                      </div>
                      <div>{fmt(p.qty, 0)}</div>
                      <div>{fmt(p.avg_entry_price)}</div>
                      <div>{fmt(p.current_price)}</div>
                      <div
                        style={{
                          color: pl >= 0 ? palette.green : palette.red,
                          fontWeight: 600,
                        }}
                      >
                        {fmt(pl)} ({fmt(plpc * 100)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const rowLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  margin: "6px 0 6px 2px",
};
