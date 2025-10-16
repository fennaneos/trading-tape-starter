
import React from 'react';

export default function ProGate({
  children,
  reason = 'Pro feature',
}: {
  children: React.ReactNode;
  reason?: string;
}) {
  const isPro = false; // replace with real plan later

  if (isPro) return <>{children}</>;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ opacity: 0.25, pointerEvents: 'none' }}>{children}</div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(10,10,10,0.65), rgba(10,10,10,0.65))',
          border: '1px dashed rgba(212,175,55,.35)',
          borderRadius: 10,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ffd700', fontWeight: 700, marginBottom: 6, filter: 'drop-shadow(0 0 12px rgba(212,175,55,.25))' }}>Pro Feature</div>
          <div style={{ opacity: 0.8, marginBottom: 10 }}>{reason}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <a className="btn-gold" href="#" onClick={e => e.preventDefault()}>Unlock Pro</a>
            <a className="btn-outline" href="#" onClick={e => e.preventDefault()}>Contact sales</a>
          </div>
        </div>
      </div>
    </div>
  );
}
