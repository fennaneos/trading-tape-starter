import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import MiniChartPro from "./components/MiniChartPro";
import AiAssistant from "./components/AiAssistant";
import Portfolio from "./pages/Portfolio";
import FAB from "./components/FAB";

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000";
type WItem = { symbol:string; name?:string };

export default function App(){
  return (
    <BrowserRouter>
      <div className="nav">
        <div className="brand">Trading Core</div>
        <div className="spacer" />
        <Link to="/" className="gb-btn gb-outline gb-pill">Charts</Link>
        <Link to="/portfolio" className="gb-btn gb-outline gb-pill">Portfolio</Link>
      </div>

      <Routes>
        <Route path="/" element={<Dashboard apiBase={API_BASE} />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/* =============== Dashboard =============== */
function Dashboard({apiBase}:{apiBase:string}){
  const [list,setList]=useState<WItem[]>([]);
  const [symbol,setSymbol]=useState("EURUSD");
  const [tf,setTf]=useState<"1m"|"5m"|"15m"|"1h"|"4h"|"1d">("1m");
  const [mode,setMode]=useState<"candles"|"line"|"both">("both");
  const [showVolume,setShowVolume]=useState(true);
  const [rsiPane,setRsiPane]=useState(false);
  const [macdPane,setMacdPane]=useState(false);
  const [emaFast,setEmaFast]=useState(12);
  const [emaSlow,setEmaSlow]=useState(26);
  const [showBB,setShowBB]=useState(false);
  const [bbPeriod,setBbPeriod]=useState(20);
  const [bbK,setBbK]=useState(2);
  const [annotations,setAnnotations]=useState<{level:number;type:"support"|"resistance"}[]>([]);

  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch(`${apiBase}/api/user/watchlist`,{cache:"no-store"});
        if(r.ok){
          const arr:WItem[] = await r.json();
          setList(arr);
          if(arr.length) setSymbol(arr[0].symbol);
        }else{
          setList([
            {symbol:"EURUSD",name:"EUR/USD"},
            {symbol:"USDJPY",name:"USD/JPY"},
            {symbol:"XAUUSD",name:"Gold"},
            {symbol:"UKOIL",name:"Brent"},
            {symbol:"SPX",name:"S&P 500"},
            {symbol:"NDX",name:"Nasdaq 100"},
            {symbol:"BTCUSD",name:"BTC/USD"},
            {symbol:"ETHUSD",name:"ETH/USD"},
          ]);
        }
      }catch{}
    })();
  },[apiBase]);

  const onAdd = async (s:string)=>{
    s=s.toUpperCase().replace(/\s+/g,''); if(!s) return;
    try{
      const res=await fetch(`${apiBase}/api/user/watchlist`,{
        method:"POST", headers:{'Content-Type':'application/json'},
        body:JSON.stringify({symbol:s,name:s})
      });
      if(res.ok){ const j=await res.json(); setList(j.watchlist); }
      else setList([...list,{symbol:s,name:s}]);
    }catch{ setList([...list,{symbol:s,name:s}]); }
  };
  const onDel = async (s:string)=>{
    try{
      const res=await fetch(`${apiBase}/api/user/watchlist/`+encodeURIComponent(s),{method:"DELETE"});
      if(res.ok){
        const j=await res.json(); setList(j.watchlist);
        if(symbol===s && j.watchlist.length) setSymbol(j.watchlist[0].symbol);
      }else{ setList(list.filter(x=>x.symbol!==s)); }
    }catch{ setList(list.filter(x=>x.symbol!==s)); }
  };

  const toggleRSI=(v:boolean)=>{ setRsiPane(v); if(v) setMacdPane(false); };
  const toggleMACD=(v:boolean)=>{ setMacdPane(v); if(v) setRsiPane(false); };
  useEffect(()=>{ setAnnotations([]); },[symbol,tf]);

  const quickOrder = (side:"buy"|"sell")=>{
    alert(`Demo ${side.toUpperCase()} market ticket for ${symbol} — wire to /api/orders in real app.`);
  };

  return (
    <>
      <div className="grid">
        {/* Watchlist */}
        <div className="panel">
          <div className="panelHeader">Watchlist</div>
          <div>
            {list.map(it=>(
              <div className="item" key={it.symbol}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button className="gb-btn gb-outline" onClick={()=>setSymbol(it.symbol)}>{it.symbol}</button>
                  <span className="badge">{it.name||it.symbol}</span>
                </div>
                <button className="gb-btn gb-ghost" onClick={()=>onDel(it.symbol)}>Remove</button>
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <input id="symIn" className="input" placeholder="Add symbol (e.g. BTCUSD)"/>
              <button className="gb-btn gb-solid"
                onClick={()=>{
                  const el=document.getElementById('symIn') as HTMLInputElement;
                  onAdd(el.value); if(el) el.value='';
                }}>Add</button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="panel">
          <div className="panelHeader">Chart</div>
          <div>
            <div className="controls">
              <select value={symbol} onChange={e=>setSymbol(e.target.value as any)}>
                {list.map(it=><option key={it.symbol} value={it.symbol}>{it.symbol}</option>)}
                {!list.length && <option value="EURUSD">EURUSD</option>}
              </select>
              <select value={tf} onChange={e=>setTf(e.target.value as any)}>
                {["1m","5m","15m","1h","4h","1d"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select value={mode} onChange={e=>setMode(e.target.value as any)}>
                {["both","candles","line"].map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <label style={{display:'inline-flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={showVolume} disabled={rsiPane||macdPane} onChange={e=>setShowVolume(e.target.checked)}/> Volume
              </label>
              <label style={{display:'inline-flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={rsiPane} onChange={e=>toggleRSI(e.target.checked)}/> RSI Pane
              </label>
              <label style={{display:'inline-flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={macdPane} onChange={e=>toggleMACD(e.target.checked)}/> MACD Pane
              </label>
              <span>EMA Fast</span>
              <input className="num" type="number" value={emaFast} onChange={e=>setEmaFast(parseInt(e.target.value||'0')||0)} />
              <span>EMA Slow</span>
              <input className="num" type="number" value={emaSlow} onChange={e=>setEmaSlow(parseInt(e.target.value||'0')||0)} />
              <label style={{display:'inline-flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={showBB} onChange={e=>setShowBB(e.target.checked)}/> Bollinger
              </label>
              <span>BB Period</span>
              <input className="num" type="number" style={{width:60}} value={bbPeriod} onChange={e=>setBbPeriod(parseInt(e.target.value||'20')||20)} />
              <span>k</span>
              <input className="num" type="number" style={{width:50}} value={bbK} onChange={e=>setBbK(parseFloat(e.target.value||'2')||2)} />
            </div>

            <MiniChartPro
              symbol={symbol} tf={tf} mode={mode}
              showVolume={showVolume}
              rsiPane={rsiPane} macdPane={macdPane}
              emaFast={emaFast} emaSlow={emaSlow}
              showBB={showBB} bbPeriod={bbPeriod} bbK={bbK}
              annotations={annotations}
            />

            <hr className="sep" />
            <div style={{opacity:.8,fontSize:12}}>
              Tip: run server with <code>USE_BINANCE=true</code> to get live BTC/ETH candles.
            </div>
          </div>
        </div>

        {/* AI + Upgrade placeholder */}
        <div className="panel">
          <div className="panelHeader">AI Market Assistant</div>
          <AiAssistant symbol={symbol} tf={tf} onAnnotate={setAnnotations} />
          <div style={{opacity:.65,fontSize:12,marginTop:6}}>
            Set <code>OPENAI_API_KEY</code> on the server to use LLM; otherwise rule-based summary.
          </div>

          <hr className="sep" />
          <div className="panelHeader">Upgrade</div>
          <ul style={{margin:0,paddingLeft:18,opacity:.85}}>
            <li>AI Signals & Alerts</li>
            <li>Backtesting & Strategy Builder</li>
            <li>Risk (VaR, Correlation)</li>
            <li>Premium Indicators (BB, MACD, multi-pane)</li>
          </ul>
          <div style={{marginTop:10}}>
            <button className="gb-btn gb-primary gb-pill">Unlock Pro</button>
          </div>
        </div>
      </div>

      {/* Mobile quick actions */}
      <FAB
        onAddSymbol={onAdd}
        onQuickOrder={quickOrder}
      />
    </>
  );
}
