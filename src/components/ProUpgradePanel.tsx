
import React from 'react';

export default function ProUpgradePanel() {
  return (
    <div className="panel">
      <div className="panelHeader">Upgrade</div>
      <div className="panelBody">
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
          <span>Current plan</span>
          <b style={{ color: '#ffd700' }}>FREE</b>
        </div>
        <ul style={{margin:'8px 0 12px 16px'}}>
          <li>AI Trade Signals & Alerts</li>
          <li>Backtesting & Strategy Builder</li>
          <li>Portfolio Risk (VaR, Correlation)</li>
          <li>Premium Indicators (BB, MACD, multi-pane)</li>
          <li>Education bundle + Coach</li>
        </ul>
        <button className="btn-gold" style={{ width: '100%' }}>Unlock Pro</button>
        <div className="subtle" style={{ marginTop: 8 }}>
          7-day free trial. Cancel anytime. Not financial advice.
        </div>
      </div>
    </div>
  );
}
