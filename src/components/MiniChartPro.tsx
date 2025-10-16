
import React, { useEffect, useRef, useState } from 'react';

type Mode = 'candles' | 'line' | 'both';
type Candle = { t:number; o:number; h:number; l:number; c:number; v:number };

function ema(values:number[], period:number){
  if(!values.length || period<=1) return values.slice();
  const k = 2 / (period + 1);
  const out = new Array(values.length);
  out[0] = values[0];
  for(let i=1;i<values.length;i++){
    out[i] = values[i]*k + out[i-1]*(1-k);
  }
  return out;
}

function mockCandles(n:number, start=Date.now()-n*60_000){
  const arr:Candle[] = [];
  let px = 1.1000;
  for(let i=0;i<n;i++){
    const t = start + i*60_000;
    const drift = (Math.random()-0.5)*0.002;
    const o = px;
    const c = Math.max(0.5, o + drift);
    const h = Math.max(o, c) + Math.random()*0.0008;
    const l = Math.min(o, c) - Math.random()*0.0008;
    const v = Math.random()*10+1;
    arr.push({t,o,h,l,c,v}); px = c;
  }
  return arr;
}

export default function MiniChartPro({
  symbol, tf='1m', mode='both',
  showVolume=true,
  emaFast=12, emaSlow=26,
  showBB=false, bbPeriod=20, bbK=2,
  annotations=[]
}:{
  symbol:string; tf?:string; mode?:Mode;
  showVolume?:boolean;
  emaFast?:number; emaSlow?:number;
  showBB?:boolean; bbPeriod?:number; bbK?:number;
  annotations?: {level:number; type:'support'|'resistance'}[];
}){
  const [data, setData] = useState<Candle[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000';

  useEffect(()=>{
    let alive = true;
    (async ()=>{
      try{
        const res = await fetch(`${API_BASE}/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=240`, {cache:'no-store'});
        if(res.ok){
          const j = await res.json();
          if(alive) setData(j);
        }else{
          if(alive) setData(mockCandles(240));
        }
      }catch{
        if(alive) setData(mockCandles(240));
      }
    })();
    return ()=>{ alive = false };
  }, [symbol, tf, API_BASE]);

  useEffect(()=>{
    const el = wrapRef.current;
    if(!el) return;
    const canvas = document.createElement('canvas');
    const w = el.clientWidth || 780;
    const h = el.clientHeight || 420;
    canvas.width = w; canvas.height = h;
    el.innerHTML=''; el.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0d1218'; ctx.fillRect(0,0,w,h);

    if(!data.length){ return; }

    const pad = {l:48, r:10, t:10, b:80};
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const closes = data.map(d=>d.c);
    const highs = data.map(d=>d.h);
    const lows = data.map(d=>d.l);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const volMax = Math.max(...data.map(d=>d.v));

    const xAt = (i:number)=> pad.l + i* (plotW / Math.max(1, data.length-1));
    const yAt = (px:number)=> pad.t + (max - px) * (plotH / (max-min + 1e-9));

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for(let g=0; g<=5; g++){
      const yy = pad.t + (plotH/5)*g;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w-pad.r, yy); ctx.stroke();
    }

    // candles
    if(mode!=='line'){
      const cw = Math.max(1, plotW / data.length * 0.7);
      data.forEach((d, i)=>{
        const x = xAt(i);
        const yO = yAt(d.o), yC = yAt(d.c), yH = yAt(d.h), yL = yAt(d.l);
        const up = d.c >= d.o;
        ctx.strokeStyle = up ? '#2ecc71' : '#e74c3c';
        ctx.fillStyle = up ? 'rgba(46,204,113,.8)' : 'rgba(231,76,60,.8)';
        // wicks
        ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
        // body
        const bx = x - cw/2;
        const by = Math.min(yO, yC);
        const bh = Math.max(2, Math.abs(yC - yO));
        ctx.fillRect(bx, by, cw, bh);
      });
    }

    // line (close)
    if(mode!=='candles'){
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      closes.forEach((c,i)=>{
        const x = xAt(i), y = yAt(c);
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    // EMAs
    const fast = ema(closes, Math.max(2, emaFast|0));
    const slow = ema(closes, Math.max(2, emaSlow|0));
    ctx.strokeStyle = '#4dc9ff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); fast.forEach((c,i)=>{ const x=xAt(i), y=yAt(c); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
    ctx.strokeStyle = '#ffa14d'; ctx.beginPath(); slow.forEach((c,i)=>{ const x=xAt(i), y=yAt(c); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();

    // annotations (support/resistance dashed)
    ctx.setLineDash([6,6]);
    ctx.lineWidth = 1;
    annotations.forEach(a=>{
      ctx.strokeStyle = a.type==='support' ? 'rgba(46,204,113,.7)' : 'rgba(255,206,86,.85)';
      const yy = yAt(a.level);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w-pad.r, yy); ctx.stroke();
    });
    ctx.setLineDash([]);

    // volume (bottom)
    if(showVolume){
      const vh = 70;
      const vy0 = h - vh - 8;
      const barW = Math.max(1, plotW / data.length * 0.7);
      data.forEach((d,i)=>{
        const x = xAt(i);
        const up = d.c >= d.o;
        const vH = (d.v / (volMax||1)) * vh;
        ctx.fillStyle = up ? 'rgba(46,204,113,.6)' : 'rgba(231,76,60,.6)';
        ctx.fillRect(x-barW/2, vy0 + (vh - vH), barW, vH);
      });
    }

    // labels - last price
    const last = closes[closes.length-1];
    const ly = yAt(last);
    ctx.strokeStyle = 'rgba(255,215,0,.7)';
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(pad.l, ly); ctx.lineTo(w-pad.r-40, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(w-pad.r-40, ly-9, 40, 18);
    ctx.fillStyle = '#000';
    ctx.font = '12px system-ui';
    ctx.fillText(last.toFixed(2), w-pad.r-38, ly+4);

  }, [data, mode, showVolume, emaFast, emaSlow, showBB, bbPeriod, bbK, annotations]);

  return (
    <div>
      <div style={{marginBottom:6, fontWeight:700}}>{symbol} - {tf} - {mode} + vol</div>
      <div ref={wrapRef} className="canvasWrap"/>
    </div>
  );
}
