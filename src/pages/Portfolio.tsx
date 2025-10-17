import React, { useMemo, useState } from "react";
import Sparkline from "../components/Sparkline";

type Holding = {
  symbol: string;
  name?: string;
  class: "FX"|"Crypto"|"Equity"|"Commodity"|"Index";
  qty: number;
  price: number;
  prev: number;
  history?: number[]; // for sparkline
};

export default function Portfolio() {
  const [cash] = useState(1250);
  const [holdings, setHoldings] = useState<Holding[]>([
    { symbol:"EURUSD", name:"EUR/USD", class:"FX", qty:5000, price:1.083, prev:1.074, history: mk(40, 1.05, 1.10) },
    { symbol:"BTCUSD", name:"Bitcoin", class:"Crypto", qty:0.22, price:68000, prev:67000, history: mk(40, 61000, 69500) },
    { symbol:"AAPL",   name:"Apple", class:"Equity", qty:12,  price:183.5, prev:178.4, history: mk(40, 170, 186) },
    { symbol:"XAUUSD", name:"Gold",  class:"Commodity", qty:1.1, price:2355, prev:2310, history: mk(40, 2200, 2360) },
  ]);

  const rows = useMemo(() => holdings.map(h => {
    const value = h.qty * h.price;
    const pnl   = h.qty * (h.price - h.prev);
    const pct   = (h.price - h.prev) / h.prev * 100;
    return {...h, value, pnl, pct};
  }), [holdings]);

  const equity = useMemo(() => cash + rows.reduce((s,r)=>s+r.value, 0), [cash, rows]);
  const dayPnL = useMemo(() => rows.reduce((s,r)=>s+r.pnl,0), [rows]);

  // allocation for donut
  const alloc = useMemo(() => {
    const byClass: Record<string, number> = {};
    rows.forEach(r => { byClass[r.class] = (byClass[r.class]||0) + r.value; });
    const total = Object.values(byClass).reduce((a,b)=>a+b,0) || 1;
    return Object.entries(byClass).map(([k,v]) => ({ k, v, w: v/total }));
  }, [rows]);

  return (
    <div className="page" style={{maxWidth:980, margin:"0 auto"}}>
      {/* ===== Top “cards like app” ===== */}
      <section className="port-hero panel" style={{marginBottom:12}}>
        <div className="row">
          <div className="sub">Total Equity</div>
          <div className="pill">{new Date().toLocaleDateString()}</div>
        </div>
        <div className="balance">${fmt(equity, 2)}</div>
        <div className="row">
          <div className="sub">Cash: ${fmt(cash,2)}</div>
          <div className={dayPnL>=0 ? "pct-up" : "pct-dn"}>
            {dayPnL>=0?"+":""}${fmt(Math.abs(dayPnL),2)} ({fmtPct(dayPnL/(equity-cash))})
          </div>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="gb-btn gb-solid">Deposit</button>
          <button className="gb-btn gb-outline">Withdraw</button>
          <button className="gb-btn gb-outline">Transfer</button>
        </div>
      </section>

      {/* ===== Allocation donut + legend ===== */}
      <section className="panel" style={{marginBottom:12}}>
        <div className="panelHeader">Diversification</div>
        <div className="row" style={{gap:16, alignItems:"center"}}>
          <Donut data={alloc} size={120}/>
          <div style={{display:"grid", gap:8}}>
            {alloc.map((a,i)=>(
              <div key={i} className="row" style={{gap:8}}>
                <div style={{
                  width:10,height:10,borderRadius:2,
                  background: DONUT_COLORS[i % DONUT_COLORS.length]
                }}/>
                <div style={{minWidth:90}}>{a.k}</div>
                <div className="sub">${fmt(a.v,0)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Positions tiles like mobile apps ===== */}
      <section className="panel">
        <div className="panelHeader">Positions</div>
        <div style={{display:"grid", gap:10}}>
          {rows.map((r, idx)=>(
            <div key={r.symbol} className="tile">
              <div style={{display:"grid", gap:4, minWidth:160}}>
                <div className="row">
                  <div className="tile-sym">{r.symbol}</div>
                  <div className="pill">{r.class}</div>
                </div>
                <div className="sub">{r.name || r.symbol}</div>
                <div className="row" style={{gap:8}}>
                  <div className="sub">Qty {fmt(r.qty, 3)}</div>
                  <div className="sub">@ {fmt(r.price, r.price>10?2:4)}</div>
                </div>
              </div>

              <div style={{flex:1}} />

              <div style={{display:"grid", textAlign:"right", gap:4}}>
                <div>${fmt(r.value, 2)}</div>
                <div className={r.pnl>=0 ? "pct-up":"pct-dn"}>
                  {r.pnl>=0?"+":""}${fmt(Math.abs(r.pnl),2)} ({fmt(r.pct,2)}%)
                </div>
                <Sparkline
                  values={r.history && r.history.length>1 ? r.history : mk(30, r.price*0.96, r.price*1.04)}
                  width={140}
                  height={32}
                  stroke={r.pnl>=0 ? "#22c55e" : "#ef4444"}
                  fill={r.pnl>=0 ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)"}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function mk(n:number, lo:number, hi:number){
  const a:number[] = []; let x=(lo+hi)/2;
  for(let i=0;i<n;i++){ x += (Math.random()-.5)*(hi-lo)*0.08; x=Math.min(hi, Math.max(lo,x)); a.push(x); }
  return a;
}
function fmt(n:number, d:number){ return n.toLocaleString(undefined,{minimumFractionDigits:d, maximumFractionDigits:d}); }
function fmtPct(v:number){ return (v*100).toFixed(2)+"%"; }

/* Simple SVG donut so we don’t need recharts */
const DONUT_COLORS = ["#ffd700","#22c55e","#3b82f6","#a855f7","#f97316","#ef4444"];
function Donut({data, size=120}:{data:{k:string,v:number,w:number}[], size?:number}){
  const R = size/2 - 8; // radius
  const C = 2*Math.PI*R;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={12}/>
      {data.map((d,i)=>{
        const len = d.w * C;
        const el = (
          <circle key={i}
            cx={size/2} cy={size/2} r={R}
            fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={12}
            strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
          />
        );
        offset += len;
        return el;
      })}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="12" fill="#9aa4ad">Alloc</text>
    </svg>
  );
}
