import React, { useState } from "react";

export default function FAB({
  onAddSymbol,
  onQuickOrder,
}:{
  onAddSymbol:(s:string)=>void;
  onQuickOrder:(side:"buy"|"sell")=>void;
}){
  const [open,setOpen]=useState(false);

  const add = ()=>{
    const s = prompt("Add symbol (e.g. BTCUSD)")?.toUpperCase().replace(/\s+/g,'');
    if(s) onAddSymbol(s);
    setOpen(false);
  };

  return (
    <>
      <button className="fab" title="Quick actions" onClick={()=>setOpen(true)}>✦</button>
      {open && (
        <div className="fab-sheet" onClick={()=>setOpen(false)}>
          <div className="fab-card" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{color:'var(--gold)',fontWeight:700}}>Quick Actions</div>
              <button className="gb-btn gb-outline gb-pill" onClick={()=>setOpen(false)}>Close</button>
            </div>
            <div style={{display:'grid',gap:8}}>
              <button className="gb-btn gb-primary gb-pill" onClick={add}>Add Symbol</button>
              <div style={{display:'flex',gap:8}}>
                <button className="gb-btn gb-solid gb-pill" onClick={()=>onQuickOrder('buy')}>Buy (demo)</button>
                <button className="gb-btn gb-ghost gb-pill" onClick={()=>onQuickOrder('sell')}>Sell (demo)</button>
              </div>
              <button className="gb-btn gb-outline gb-pill" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>Scroll to top</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
