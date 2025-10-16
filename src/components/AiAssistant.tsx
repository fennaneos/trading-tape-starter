
import React, { useState } from 'react';

export default function AiAssistant({
  symbol, tf, onAnnotate
}: { symbol:string; tf:string; onAnnotate:(anns:{level:number;type:'support'|'resistance'}[])=>void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000';

  async function ask(q:string){
    setLoading(true);
    try{
      const res = await fetch(`${API_BASE}/api/ai/analyze`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ symbol, tf, question:q })
      });
      if(res.ok){
        const j = await res.json();
        setText(j.summary || 'No summary');
        if(Array.isArray(j.annotations)) onAnnotate(j.annotations);
      }else{
        setText('Rule-based: trend up; possible resistance near recent swing highs.');
      }
    }catch{
        setText('Offline summary: sideways / mixed. Watch EMA crossovers.');
    }finally{
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:8}}>
        <input className="input" placeholder={`Ask about ${symbol} (${tf})...`} id="aiq"/>
        <button className="btn-gold" onClick={()=>{
          const el=document.getElementById('aiq') as HTMLInputElement;
          ask(el.value||'What is the current trend?');
        }}>{loading? 'Thinking…':'Ask'}</button>
      </div>
      <div className="panel" style={{padding:10}}>
        <div style={{opacity:.8, whiteSpace:'pre-wrap'}}>{text || 'Ask something to get an analysis.'}</div>
      </div>
    </div>
  );
}
