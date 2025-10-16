import React, { useMemo } from "react";

/* ==== demo holdings ==== */
type Holding = { symbol:string; qty:number; price:number; prev:number; class_:"FX"|"Crypto"|"Equity"|"Commodity" };
const SAMPLE: Holding[] = [
  { symbol:"EURUSD", qty:5000, price:1.08, prev:1.07, class_:"FX" },
  { symbol:"BTCUSD", qty:0.25, price:68000, prev:67000, class_:"Crypto" },
  { symbol:"AAPL",   qty:12, price:182, prev:178, class_:"Equity" },
  { symbol:"XAUUSD", qty:1, price:2350, prev:2300, class_:"Commodity" },
];

export default function Portfolio(){
  const rows = useMemo(()=>SAMPLE.map(h=>({
    ...h,
    value: h.qty*h.price,
    pnl: (h.price-h.prev)*h.qty,
    pnlPct: (h.price/h.prev-1)*100
  })),[]);
  const total = rows.reduce((s,r)=>s+r.value,0);
  const dayPnL = rows.reduce((s,r)=>s+r.pnl,0);

  // allocation for donut (no lib): build conic-gradient
  const alloc = Object.entries(rows.reduce((m,r)=>{
    m[r.class_] = (m[r.class_]||0)+r.value; return m;
  }, {} as Record<string,number>));
  const colors = ["#ffd700","#f59e0b","#22c55e","#60a5fa","#a78bfa"];
  const donutCss = (()=>{
    let acc = 0, parts:string[]=[];
    alloc.forEach(([_,v],i)=>{
      const a = (v/total)*360;
      parts.push(`${colors[i%colors.length]} ${acc}deg ${acc+a}deg`);
      acc += a;
    });
    return `conic-gradient(${parts.join(",")})`;
  })();

  // tiny correlation grid (dummy)
  const syms = rows.map(r=>r.symbol);
  const mat = syms.map((_,i)=>syms.map((__,j)=> i===j?1 : 0.6+Math.random()*0.35 ));

  return (
    <div style={{padding:12}}>
      <h2 style={{color:"var(--gold-2)",marginTop:0}}>Portfolio & Risk</h2>

      <div style={{display:"grid",gap:12,gridTemplateColumns:"1fr 380px"}}>
        {/* table */}
        <div className="panel">
          <div className="panelHeader">Holdings</div>
          <table className="tbl">
            <thead>
              <tr><th>Symbol</th><th>Qty</th><th>Price</th><th>Value</th><th>PnL</th><th>Class</th></tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.symbol}>
                  <td>{r.symbol}</td>
                  <td>{r.qty}</td>
                  <td>{r.price.toFixed(2)}</td>
                  <td>${r.value.toFixed(2)}</td>
                  <td style={{color:r.pnl>=0?"var(--green)":"var(--red)"}}>
                    {r.pnl.toFixed(2)} ({r.pnlPct.toFixed(2)}%)
                  </td>
                  <td>{r.class_}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>Total</td><td colSpan={3}>${total.toFixed(2)}</td></tr>
              <tr>
                <td colSpan={3}>Daily PnL</td>
                <td colSpan={3} style={{color:dayPnL>=0?"var(--green)":"var(--red)"}}>
                  ${dayPnL.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="gb-btn gb-primary gb-pill">Deposit</button>
            <button className="gb-btn gb-outline gb-pill">Export CSV</button>
          </div>
        </div>

        {/* donut + heatmap */}
        <div className="panel">
          <div className="panelHeader">Allocation</div>
          <div style={{display:"grid",placeItems:"center",margin:"8px 0 14px"}}>
            <div style={{
              width:180,height:180,borderRadius:"50%",
              background:donutCss, position:"relative"
            }}>
              <div style={{
                position:"absolute", inset:18, borderRadius:"50%",
                background:"var(--bg)", display:"grid", placeItems:"center",
                color:"var(--muted)", fontSize:12
              }}>
                ${total.toFixed(0)}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gap:6}}>
            {alloc.map(([k,v],i)=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:10,height:10,background:colors[i%colors.length],borderRadius:3}}/>
                <span style={{flex:1}}>{k}</span>
                <span>${v.toFixed(0)}</span>
              </div>
            ))}
          </div>

          <hr className="sep" />
          <div className="panelHeader">Correlation (demo)</div>
          <div style={{display:"grid",gridTemplateColumns:`80px repeat(${syms.length}, 1fr)`,gap:4,fontSize:12}}>
            <div/>
            {syms.map(s=><div key={s} style={{textAlign:"center",color:"var(--muted)"}}>{s}</div>)}
            {syms.map((row,i)=>(
              <React.Fragment key={row}>
                <div style={{color:"var(--muted)"}}>{row}</div>
                {syms.map((_,j)=>{
                  const v = mat[i][j]; // 0..1
                  const c = Math.round(40 + v*60);
                  return <div key={j} style={{
                    height:22,borderRadius:4, background:`rgb(255, 215, 0, ${v*.8})`,
                    border:"1px solid var(--line)", display:"grid", placeItems:"center",
                    color:`rgb(${c+70}, ${c+70}, ${c})`
                  }}>{v.toFixed(2)}</div>
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
