import React from 'react';
import './PaywallModal.css';

export default function PaywallModal({
  open, onClose, onUpgrade,
  title = 'Unlock Pro',
  perks = [
    'AI insights + auto annotations',
    'Premium indicators (RSI, MACD, BB)',
    'Backtesting & Strategy Builder',
    'Signals + Alerts',
  ],
}:{
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  title?: string;
  perks?: string[];
}) {
  if (!open) return null;
  return (
    <div className="pw-backdrop" onClick={onClose}>
      <div className="pw-card" onClick={(e)=>e.stopPropagation()}>
        <div className="pw-title">{title}</div>
        <ul className="pw-list">
          {perks.map((p,i)=>(<li key={i}>{p}</li>))}
        </ul>
        <div className="pw-row">
          <button className="gb-btn gb-outline" onClick={onClose}>Not now</button>
          <button className="gb-btn gb-solid" onClick={onUpgrade}>Start 7-day Trial</button>
        </div>
        <div className="pw-note">Cancel anytime. Not financial advice.</div>
      </div>
    </div>
  );
}
