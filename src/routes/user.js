import express from 'express';
import { getUser } from './billing.js';

const router = express.Router();

// GET /api/user/me -> { userId, plan }
router.get('/me', (_req, res) => {
  const u = getUser();
  res.json({ userId: u.id, plan: u.plan });
});

// Optional: POST /api/user/refresh (no-op, but lets the FE re-pull)
router.post('/refresh', (_req, res) => {
  const u = getUser();
  res.json({ ok:true, userId: u.id, plan: u.plan });
});

export default router;
