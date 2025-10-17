import React, { useMemo, useState } from "react";

type Props = {
  apiBase: string;
  defaultSymbol?: string;
  onPlaced?: (orderId?: string) => void;
};

export default function OrderTicket({ apiBase, defaultSymbol = "AAPL", onPlaced }: Props) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy"|"sell">("buy");
  const [type, setType] = useState<"market"|"limit">("market");
  const [qty, setQty] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState<number|undefined>(undefined);
  const [tif, setTif] = useState<"day"|"gtc"|"ioc"|"fok">("day");
  const [assetClass, setAssetClass] = useState<"us_equity"|"crypto">("us_equity");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const canPlace = useMemo(()=>{
    if (!symbol || !qty || qty <= 0) return false;
    if (type==="limit" && !limitPrice) return false;
    return true;
  }, [symbol, qty, type, limitPrice]);

  const preview = async () => {
    setMsg("");
    const res = await fetch(`${apiBase}/api/orders/preview`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ side, type, symbol, qty, limitPrice })
    });
    const j = await res.json();
    setMsg(res.ok ? `Preview OK${j.notional ? ` — Notional ~$${j.notional.toFixed?.(2) || j.notional}`:""}` : (j.error || "Preview failed"));
  };

  const place = async () => {
    if (!canPlace || busy) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`${apiBase}/api/orders/place`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ side, type, symbol, qty, limitPrice, tif, assetClass })
      });
      const j = await res.json();
      if (res.ok) {
        setMsg(`✅ Placed: ${j.order?.id || "OK"}`);
        onPlaced?.(j.order?.id);
      } else {
        setMsg(`❌ ${j.error || "Order failed"}`);
      }
    } catch (e:any) {
      setMsg(`❌ ${e?.message || "Network error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{minWidth:280}}>
      <div className="panelHeader">Place Order</div>

      <div style={{display:"grid", gap:8}}>
        <div style={{display:"grid", gap:6}}>
          <label className="label">Symbol</label>
          <input className="input" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} />
        </div>

        <div style={{display:"flex", gap:8}}>
          <button
            className={`gb-btn ${side==="buy"?"gb-solid":"gb-outline"}`}
            onClick={()=>setSide("buy")}
          >Buy</button>
          <button
            className={`gb-btn ${side==="sell"?"gb-solid":"gb-outline"}`}
            onClick={()=>setSide("sell")}
          >Sell</button>
        </div>

        <div style={{display:"grid", gap:6}}>
          <label className="label">Type</label>
          <select value={type} onChange={e=>setType(e.target.value as any)}>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
          </select>
        </div>

        <div style={{display:"grid", gap:6}}>
          <label className="label">{assetClass==="crypto" ? "Notional (USD)" : "Qty"}</label>
          <input className="num" type="number" value={qty} onChange={e=>setQty(parseFloat(e.target.value)||0)} />
        </div>

        {type==="limit" && (
          <div style={{display:"grid", gap:6}}>
            <label className="label">Limit Price</label>
            <input className="num" type="number" value={limitPrice ?? ""} onChange={e=>setLimitPrice(parseFloat(e.target.value)||undefined)} />
          </div>
        )}

        <div style={{display:"grid", gap:6}}>
          <label className="label">Time in Force</label>
          <select value={tif} onChange={e=>setTif(e.target.value as any)}>
            <option value="day">DAY</option>
            <option value="gtc">GTC</option>
            <option value="ioc">IOC</option>
            <option value="fok">FOK</option>
          </select>
        </div>

        <div style={{display:"grid", gap:6}}>
          <label className="label">Asset Class</label>
          <select value={assetClass} onChange={e=>setAssetClass(e.target.value as any)}>
            <option value="us_equity">US Equity</option>
            <option value="crypto">Crypto</option>
          </select>
        </div>

        <div style={{display:"flex", gap:8}}>
          <button className="gb-btn gb-outline" onClick={preview}>Preview</button>
          <button className="gb-btn gb-solid" disabled={!canPlace || busy} onClick={place}>
            {busy ? "Placing…" : "Place"}
          </button>
        </div>

        {msg && <div style={{fontSize:13, opacity:.9}}>{msg}</div>}

        <div className="sub" style={{opacity:.7, fontSize:12}}>
          Paper-trading via Alpaca. No fees/slippage here. For real trading,
          switch to live keys and base URL — and add risk checks, TP/SL brackets, and
          confirmations.
        </div>
      </div>
    </div>
  );
}
