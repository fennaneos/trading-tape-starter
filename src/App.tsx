// src/App.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

import MiniChartPro from './components/MiniChartPro';
import AiAssistant from './components/AiAssistant';
import Portfolio from './pages/Portfolio';
import ProGate from './components/ProGate';
import ProUpgradePanel from './components/ProUpgradePanel';
import HelpTip from './components/HelpTip';
import BottomTabs from './components/BottomTabs';
import PaywallModal from './components/PaywallModal';
import { PlanProvider, usePlan } from './state/PlanContext';
import FAB from './components/FAB';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000';
type WItem = { symbol: string; name?: string };

export default function App() {
  return (
    <PlanProvider>
      <BrowserRouter>
        <TopNav />
        <Routes>
          <Route path="/" element={<Dashboard apiBase={API_BASE} />} />
          <Route path="/ai" element={<AiPage apiBase={API_BASE} />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomTabs />
      </BrowserRouter>
    </PlanProvider>
  );
}

function TopNav() {
  const { plan } = usePlan();
  return (
    <div className="topnav">
      <img src="https://dummyimage.com/28x28/222/fff&text=¥" width={28} height={28} style={{borderRadius:8}}/>
      <div className="brand">Trading Core</div>
      <div style={{flex:1}}/>
      <div className="nav-links hide-mobile">
        <Link to="/" className="gb-btn gb-outline">Charts</Link>
        <Link to="/ai" className="gb-btn gb-outline">AI</Link>
        <Link to="/portfolio" className="gb-btn gb-outline">Portfolio</Link>
        <span className="badge" style={{marginLeft:6}}>{plan.toUpperCase()}</span>
      </div>
    </div>
  );
}

/* ======================
   Dashboard (Charts)
   ====================== */
function Dashboard({apiBase}:{apiBase:string}) {
  const [list, setList] = useState<WItem[]>([]);
  const [symbol, setSymbol] = useState<string>('EURUSD');
  const [tf, setTf] = useState<'1m'|'5m'|'15m'|'1h'|'4h'|'1d'>('1m');
  const [mode, setMode] = useState<'candles'|'line'|'both'>('both');

  const [showVolume, setShowVolume] = useState(true);
  const [rsiPane, setRsiPane] = useState(false);
  const [macdPane, setMacdPane] = useState(false);
  const [emaFast, setEmaFast] = useState(12);
  const [emaSlow, setEmaSlow] = useState(26);
  const [showBB, setShowBB] = useState(false);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbK, setBbK] = useState(2);
  const [annotations, setAnnotations] = useState<{level:number; type:'support'|'resistance'}[]>([]);

  const [paywallOpen, setPaywallOpen] = useState(false);
  const { isPro, refreshPlan } = usePlan();

  // watchlist
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/user/watchlist`, { cache: 'no-store' });
        if (res.ok) {
          const arr = await res.json(); setList(arr);
          if (arr.length) setSymbol(arr[0].symbol);
        } else {
          setList([
            {symbol:'EURUSD', name:'EUR/USD'},
            {symbol:'USDJPY', name:'USD/JPY'},
            {symbol:'XAUUSD', name:'Gold'},
            {symbol:'UKOIL', name:'Brent'},
            {symbol:'SPX', name:'S&P 500'},
            {symbol:'NDX', name:'Nasdaq 100'},
            {symbol:'BTCUSD', name:'BTC/USD'},
            {symbol:'ETHUSD', name:'ETH/USD'},
          ]);
        }
      } catch {}
    })();
  }, [apiBase]);

  const onAdd = async (s: string) => {
    s = s.toUpperCase().replace(/\s+/g, '');
    if (!s) return;
    try {
      const res = await fetch(`${apiBase}/api/user/watchlist`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({symbol:s, name:s})
      });
      if (res.ok) {
        const j = await res.json(); setList(j.watchlist);
      } else {
        setList(prev => [...prev, {symbol:s, name:s}]);
      }
    } catch {
      setList(prev => [...prev, {symbol:s, name:s}]);
    }
  };

  const onDel = async (s: string) => {
    try {
      const res = await fetch(`${apiBase}/api/user/watchlist/${encodeURIComponent(s)}`, {method:'DELETE'});
      if (res.ok) {
        const j = await res.json(); setList(j.watchlist);
        if (symbol===s && j.watchlist.length) setSymbol(j.watchlist[0].symbol);
      } else {
        setList(prev => prev.filter(x => x.symbol!==s));
      }
    } catch {
      setList(prev => prev.filter(x => x.symbol!==s));
    }
  };

  const requirePro = (cb: ()=>void) => {
    if (isPro) cb(); else setPaywallOpen(true);
  };
  const toggleRSI = (v:boolean)=> requirePro(()=>{ setRsiPane(v); if(v) setMacdPane(false); });
  const toggleMACD = (v:boolean)=> requirePro(()=>{ setMacdPane(v); if(v) setRsiPane(false); });
  const toggleBB = (v:boolean)=> requirePro(()=> setShowBB(v));

  useEffect(()=> setAnnotations([]), [symbol, tf]);

  // Mobile quick actions row (sticks above bottom tabs)
  const MobileQuickBar = useMemo(()=>(
    <div className="quickbar show-mobile">
      <select value={symbol} onChange={e=>setSymbol(e.target.value as any)}>
        {list.map(it => <option key={it.symbol} value={it.symbol}>{it.symbol}</option>)}
      </select>
      <select value={tf} onChange={e=>setTf(e.target.value as any)}>
        {['1m','5m','15m','1h','4h','1d'].map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={mode} onChange={e=>setMode(e.target.value as any)}>
        {['both','candles','line'].map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  ),[symbol,tf,mode,list]);

  return (
    <>
      <div className="page charts">
        <div className="grid dash-grid">
          {/* Watchlist */}
          <div className="panel">
            <div className="panelHeader">Watchlist</div>
            <div className="panelBody">
              {list.map(it => (
                <div className="item" key={it.symbol}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button className="gb-btn gb-outline" onClick={()=>setSymbol(it.symbol)}>{it.symbol}</button>
                    <span className="badge">{it.name || it.symbol}</span>
                  </div>
                  <button className="gb-btn gb-ghost" onClick={()=>onDel(it.symbol)}>Remove</button>
                </div>
              ))}
              <div className="inputRow">
                <input className="input" placeholder="Add symbol (e.g. BTCUSD)" id="symIn"/>
                <button className="gb-btn gb-solid" onClick={()=>{
                  const el=document.getElementById('symIn') as HTMLInputElement;
                  onAdd(el.value); if(el) el.value='';
                }}>Add</button>
                <button className="gb-btn gb-outline" onClick={()=>{
                  alert('Common symbols:\n\nFX: EURUSD, USDJPY, XAUUSD\nIndices: SPX, NDX\nCrypto: BTCUSD, ETHUSD\nCommodities: UKOIL');
                }}>Symbols</button>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="panel">
            <div className="panelHeader">Chart</div>
            <div className="panelBody">
              <div className="controls">
                <div className="controls-row">
                  <label className="label">Symbol</label>
                  <select value={symbol} onChange={e=>setSymbol(e.target.value as any)}>
                    {list.map(it => <option key={it.symbol} value={it.symbol}>{it.symbol}</option>)}
                    {!list.length && <option value="EURUSD">EURUSD</option>}
                  </select>

                  <label className="label">TF</label>
                  <select value={tf} onChange={e=>setTf(e.target.value as any)}>
                    {['1m','5m','15m','1h','4h','1d'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <label className="label">Mode</label>
                  <select value={mode} onChange={e=>setMode(e.target.value as any)}>
                    {['both','candles','line'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="controls-row">
                  <label className="toggle">
                    <input type="checkbox" checked={showVolume} disabled={rsiPane||macdPane} onChange={e=>setShowVolume(e.target.checked)}/>
                    Volume <HelpTip title="Volume" body="Show traded volume (disabled when an oscillator pane is visible)."/>
                  </label>

                  <label className="toggle">
                    <input type="checkbox" checked={rsiPane} onChange={e=>toggleRSI(e.target.checked)}/>
                    RSI Pane <HelpTip title="RSI" body="Momentum oscillator. Unlocks with Pro."/>
                  </label>

                  <label className="toggle">
                    <input type="checkbox" checked={macdPane} onChange={e=>toggleMACD(e.target.checked)}/>
                    MACD Pane <HelpTip title="MACD" body="Trend/momentum indicator. Unlocks with Pro."/>
                  </label>

                  <span className="label">EMA Fast</span>
                  <input className="num" type="number" value={emaFast} onChange={e=>setEmaFast(parseInt(e.target.value||'0')||0)} />
                  <span className="label">EMA Slow</span>
                  <input className="num" type="number" value={emaSlow} onChange={e=>setEmaSlow(parseInt(e.target.value||'0')||0)} />

                  <label className="toggle">
                    <input type="checkbox" checked={showBB} onChange={e=>toggleBB(e.target.checked)}/>
                    Bollinger <HelpTip title="Bollinger Bands" body="Volatility bands around a moving average. Unlocks with Pro."/>
                  </label>
                  <span className="label">BB Period</span>
                  <input className="num" type="number" value={bbPeriod} onChange={e=>setBbPeriod(parseInt(e.target.value||'20')||20)} />
                  <span className="label">k</span>
                  <input className="num" type="number" value={bbK} onChange={e=>setBbK(parseFloat(e.target.value||'2')||2)} />
                </div>
              </div>

              <MiniChartPro
                symbol={symbol}
                tf={tf}
                mode={mode}
                showVolume={showVolume}
                rsiPane={rsiPane}
                macdPane={macdPane}
                emaFast={emaFast}
                emaSlow={emaSlow}
                showBB={showBB}
                bbPeriod={bbPeriod}
                bbK={bbK}
                annotations={annotations}
                crosshair={true}             // ✅ ensure crosshair is enabled
              />

              <hr className="sep" />
              <div style={{opacity:.8,fontSize:12}}>
                Tip: run server with <code>USE_BINANCE=true</code> to get live BTC/ETH candles.
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="right-col">
            <div className="panel">
              <div className="panelHeader">AI Market Assistant</div>
              <div className="panelBody">
                <ProGate reason="AI insights, trend classification, and automated chart annotations.">
                  <AiAssistant symbol={symbol} tf={tf} onAnnotate={setAnnotations}/>
                </ProGate>
                <div style={{opacity:.65, fontSize:12, marginTop:6}}>
                  Set <code>OPENAI_API_KEY</code> on the server to use LLM; otherwise a rule-based summary is returned.
                </div>
              </div>
            </div>
            <div className="hide-mobile">
              <ProUpgradePanel onUpgradeClick={()=>setPaywallOpen(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile quick action bar */}
      {MobileQuickBar}

      {/* Floating actions (above bottom tabs) */}
      <FAB
        apiBase={API_BASE}
        defaultSymbol={symbol}
        onAddSymbol={(s)=>onAdd(s)}
        style={{ bottom: 72+14 }}  // 72px tab bar + spacing
      />

      {/* Paywall */}
      <PaywallModal
        open={paywallOpen}
        onClose={()=>setPaywallOpen(false)}
        onUpgrade={async ()=>{
          try{
            const res = await fetch(`${API_BASE}/api/billing/upgrade`, {method:'POST'});
            if(res.ok){
              await fetch(`${API_BASE}/api/user/refresh`, {method:'POST'});
              await refreshPlan();
            }
          }catch{}
          setPaywallOpen(false);
        }}
      />
    </>
  );
}

/* ======================
   AI page (mobile tab)
   ====================== */
function AiPage({apiBase}:{apiBase:string}) {
  const [symbol, setSymbol] = useState('BTCUSD');
  const [tf, setTf] = useState<'1m'|'5m'|'15m'|'1h'|'4h'|'1d'>('1h');
  return (
    <div className="page" style={{paddingBottom:72}}>
      <div className="panel">
        <div className="panelHeader">AI Market Assistant</div>
        <div className="panelBody">
          <div className="controls">
            <div className="controls-row">
              <input className="input" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())}/>
              <select value={tf} onChange={e=>setTf(e.target.value as any)}>
                {['1m','5m','15m','1h','4h','1d'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <ProGate reason="AI insights, trend classification, and automated chart annotations.">
            <AiAssistant symbol={symbol} tf={tf} onAnnotate={()=>{}}/>
          </ProGate>
        </div>
      </div>
    </div>
  );
}
