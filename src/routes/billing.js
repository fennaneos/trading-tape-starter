import express from 'express';


// naive in-memory user store (single-user demo)
const db = {
  user: { id: 'u_demo', plan: process.env.DEFAULT_PLAN === 'pro' ? 'pro' : 'free' }
};

export function getUser() { return db.user; }
export function setPlan(p){ db.user.plan = p; }

const router = express.Router();

router.post('/upgrade', async (_req, res) => {
  // Here you’d create a Stripe Checkout Session or similar.
  setPlan('pro');
  return res.json({ ok: true, plan: 'pro' });
});

router.post('/cancel', async (_req, res) => {
  // Cancel recurring billing in your PSP…
  setPlan('free');
  return res.json({ ok: true, plan: 'free' });
});

export default router;
