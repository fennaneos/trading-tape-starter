import React from 'react';
import './pro.module.css';

export default function ProUpgradePanel({ onUpgradeClick }:{ onUpgradeClick?: ()=>void }) {
  return (
    <div className="panel">
      <div className="panelHeader">Upgrade</div>
      <div className="panelBody">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{opacity:.8}}>Current plan</div>
            <div style={{fontWeight:800, color:'#ffd700'}}>FREE</div>
          </div>
          <button className="gb-btn gb-solid" onClick={onUpgradeClick}>Unlock Pro</button>
        </div>
        <ul style={{marginTop:10, paddingLeft:18}}>
          <li>AI Trade Signals & Alerts</li>
          <li>Backtesting & Strategy Builder</li>
          <li>Portfolio Risk (VaR, Correlation)</li>
          <li>Premium Indicators (BB, MACD, multi-pane)</li>
          <li>Education bundle + Coach</li>
        </ul>
        <div style={{opacity:.6, fontSize:12, marginTop:6}}>7-day free trial. Cancel anytime. Not financial advice.</div>
      </div>
    </div>
  );
}
