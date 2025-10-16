import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';

type Plan = 'free' | 'pro';
type PlanCtx = {
  plan: Plan;
  setPlan: (p: Plan) => void;
  isPro: boolean;
  refreshPlan: () => Promise<void>;
};

const Ctx = createContext<PlanCtx | null>(null);

// Read API base from Vite env
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000';

export function PlanProvider({children}:{children: React.ReactNode}) {
  // 1) boot from localStorage (so UI doesn’t flicker)
  const [plan, setPlan] = useState<Plan>(() => {
    const saved = localStorage.getItem('plan');
    return (saved === 'pro' || saved === 'free') ? (saved as Plan) : 'free';
  });

  // 2) hydrate from server
  async function refreshPlan() {
    try {
      const res = await fetch(`${API_BASE}/api/user/me`, {cache:'no-store'});
      if (res.ok) {
        const j = await res.json();
        if (j?.plan === 'pro' || j?.plan === 'free') {
          setPlan(j.plan);
          localStorage.setItem('plan', j.plan);
        }
      }
    } catch {}
  }
  useEffect(()=>{ refreshPlan(); }, []);

  // 3) persist on manual changes too (e.g. after upgrade)
  useEffect(()=>{ localStorage.setItem('plan', plan); }, [plan]);

  const value = useMemo(
    () => ({ plan, setPlan, isPro: plan === 'pro', refreshPlan }),
    [plan]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlan() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}
