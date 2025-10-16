import React from 'react';
import { NavLink } from 'react-router-dom';
import { usePlan } from '../state/PlanContext';
import './BottomTabs.css';

export default function BottomTabs() {
  const { plan } = usePlan();
  return (
    <nav className="btabs">
      <Tab to="/" label="Charts" icon="📈" end />
      <Tab to="/ai" label="AI" icon="🧠" badge={plan==='pro' ? 'PRO' : undefined}/>
      <Tab to="/portfolio" label="Portfolio" icon="💼" />
    </nav>
  );
}

function Tab({to, label, icon, badge, end}:{to:string; label:string; icon:string; badge?:string; end?:boolean}) {
  return (
    <NavLink to={to} end={end} className={({isActive}) => 'btab' + (isActive ? ' active' : '')}>
      <span className="btab-ic">{icon}</span>
      <span className="btab-tx">{label}</span>
      {badge && <span className="btab-badge">{badge}</span>}
    </NavLink>
  );
}
