// src/components/TradeModal.tsx
import React, { useEffect, useMemo, useState } from "react";

type Side = "buy" | "sell";
type OrdType = "market" | "limit";
type TIF = "day" | "gtc";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000";

type Quote = { symbol: string; bid?: number; ask?: number; mid?: number; ts?: number };

function fmt(n?: number | string, d = 2) {
  if (n === undefined || n === null) return "-";
  const x = typeof n === "string" ? Number(n) : n;
  if (!isFinite(x)) return "-";
  return x.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function TradeModal({
  open,
  onClose,
  symbol,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  symbol: string;
  onPlaced?: () => void;
}) {
  const [sym, setSym] = useState(symbol);
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<OrdType>("market");
  const [qty, setQty] = useState<string>("1");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [tif, setTif] = useState<TIF>("day");
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => setSym(symbol), [symbol]);

  // fetch quote (demo fallback if broker not wired)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/broker/alpaca/quote/${encodeURIComponent(sym)}`, { cache: "no-store" });
        if (!r.ok) throw new Error("no broker");
        const j = await r.json();
        const bid = j.quote?.bp ?? undefined;
        const ask = j.quote?.ap ?? undefined;
        const mid = bid && ask ? (Number(bid) + Number(ask)) / 2 : (bid ?? ask ?? undefined);
        if (alive) setQuote({ symbol: sym, bid: bid ? Number(bid) : undefined, ask: ask ? Number(ask) : undefined, mid: mid ? Number(mid) : undefined, ts: Date.now() });
      } catch {
        const base = sym.toUpperCase().charCodeAt(0) % 90;
        const mid = 100 + (base % 25) + Math.random() * 3;
        if (alive) setQuote({ symbol: sym, bid: mid - 0.05, ask: mid + 0.05, mid, ts: Date.now() });
      }
    })();
    return () => { alive = false; };
  }, [open, sym]);

  const pxPreview =
    type === "limit" ? Number(limitPrice) || undefined : quote?.ask || quote?.mid || undefined;

  const notional = useMemo(() => {
    const px = pxPreview;
    const q = Number(qty) || 0;
    return px && q ? px * q : undefined;
  }, [pxPreview, qty]);

  async function place() {
    setMsg("");
    setPlacing(true);
    try {
      const payload: any = { symbol: sym, side, qty: Number(qty) || 1, type, tif };
      if (type === "limit") payload.limitPrice = Number(limitPrice) || undefined;

      const r = await fetch(`${API_BASE}/api/broker/alpaca/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      setMsg(`Order accepted: ${j.id} (${j.status})`);
      onPlaced?.();
      setTimeout(onClose, 700);
    } catch (e: any) {
      setMsg(`Order failed: ${e.message || e.toString()}`);
    } finally {
      setPlacing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modalOverlay" onClick={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
      <div className="modalCard">
        <div className="modalHeader">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="https://dummyimage.com/24x24/222/fff&text=¥" width={24} height={24} style={{borderRadius:6}}/>
            <strong style={{color:"#ffd700"}}>Place Order</strong>
          </div>
          <button className="gb-btn gb-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="modalBody">
          {/* row 1: symbol + quote pill */}
          <div className="row">
            <div className="col">
              <label className="label">Symbol</label>
              <div style={{display:"flex",gap:8}}>
                <input className="input" value={sym} onChange={e=>setSym(e.target.value.toUpperCase())} placeholder="AAPL / TSLA / SPY / BTCUSD"/>
                <button className="gb-btn gb-outline" onClick={()=>{
                  alert("Examples:\nStocks: AAPL, TSLA, MSFT\nETF: SPY, QQQ\nCrypto: BTCUSD, ETHUSD");
                }}>?</button>
              </div>
            </div>
            <div className="col" style={{alignSelf:"end", textAlign:"right"}}>
              <span className="pill">
                {quote?.symbol || sym}: bid {fmt(quote?.bid)} / ask {fmt(quote?.ask)}
              </span>
            </div>
          </div>

          {/* row 2: side */}
          <div className="row">
            <div className="col">
              <label className="label">Side</label>
              <div style={{display:"flex",gap:8}}>
                <button
                  className="gb-btn"
                  style={{
                    flex:1,
                    background: side==="buy" ? "rgba(34,197,94,.15)" : "transparent",
                    borderColor: side==="buy" ? "rgba(34,197,94,.45)" : "rgba(212,175,55,.35)",
                    color: side==="buy" ? "#22c55e" : "#e7e7e7"
                  }}
                  onClick={()=>setSide("buy")}
                >Buy</button>
                <button
                  className="gb-btn"
                  style={{
                    flex:1,
                    background: side==="sell" ? "rgba(239,68,68,.15)" : "transparent",
                    borderColor: side==="sell" ? "rgba(239,68,68,.45)" : "rgba(212,175,55,.35)",
                    color: side==="sell" ? "#ef4444" : "#e7e7e7"
                  }}
                  onClick={()=>setSide("sell")}
                >Sell</button>
              </div>
            </div>
          </div>

          {/* row 3: type/qty */}
          <div className="row two">
            <div className="col">
              <label className="label">Type</label>
              <select className="select" value={type} onChange={e=>setType(e.target.value as OrdType)}>
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>
            <div className="col">
              <label className="label">Qty</label>
              <input className="num" value={qty} onChange={e=>setQty(e.target.value.replace(/[^\d.]/g,""))}/>
            </div>
          </div>

          {/* row 4: price/TIF */}
          <div className="row two">
            <div className="col">
              <label className="label">Price</label>
              <input className="num" value={limitPrice} disabled={type!=="limit"} placeholder={type==="limit" ? "Limit price" : "—"} onChange={e=>setLimitPrice(e.target.value.replace(/[^\d.]/g,""))}/>
            </div>
            <div className="col">
              <label className="label">TIF</label>
              <select className="select" value={tif} onChange={e=>setTif(e.target.value as TIF)}>
                <option value="day">DAY</option>
                <option value="gtc">GTC</option>
              </select>
            </div>
          </div>

          {/* row 5: preview + place */}
          <div className="row" style={{alignItems:"center"}}>
            <span className="pill">
              {side.toUpperCase()} {qty || 0} {sym} @ {fmt(pxPreview)} ≈ {fmt(notional)}
            </span>
            <div style={{flex:1}}/>
            <button className="gb-btn gb-solid" onClick={place} disabled={placing}>
              {placing ? "Placing…" : "Place Order"}
            </button>
          </div>

          {msg && (
            <div style={{marginTop:8, fontSize:12, color: msg.includes("failed") ? "#ef4444" : "#22c55e"}}>
              {msg}
            </div>
          )}

          <div style={{marginTop:10, opacity:.65, fontSize:12}}>
            Paper trading supported via your server proxy. If you haven’t wired a broker yet, quotes are demo and orders won’t be routed.
          </div>
        </div>
      </div>
    </div>
  );
}
