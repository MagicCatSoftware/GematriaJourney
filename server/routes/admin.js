// server/routes/admin.js
import { Router } from 'express';
import mongoose from 'mongoose';
import { authRequired } from '../middleware/auth.js';
import { ensureAuth, requireAdmin, requirePaid, rejectBanned } from '../middleware/auth.js';

import User from '../models/User.js';
import Gematria from '../models/Gematria.js';     // <- ensure this exists
import Entry from '../models/Entry.js';           // <- or whatever your "entries" are

const router = Router();

// All admin routes require login + admin
router.use(authRequired, requireAdmin);

// --- Dashboard snapshot
router.get('/overview', async (_req, res) => {
  const [users, banned, gematrias, entries] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isBanned: true }),
    Gematria.countDocuments({}),
    Entry.countDocuments({})
  ]);
  res.json({ users, banned, gematrias, entries });
});

// --- Users list (with optional search)
router.get('/users', async (req, res) => {
  const q = (req.query.q || '').trim();
  const where = q
    ? { $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] }
    : {};
  const users = await User.find(where).sort('-createdAt').limit(500).lean();
  res.json({ users });
});

// --- Ban / Unban
router.patch('/users/:id/ban', async (req, res) => {
  const { id } = req.params;
  const { ban = true } = req.body;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  const user = await User.findByIdAndUpdate(id, { isBanned: !!ban }, { new: true });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, user });
});

// --- Promote / Demote admin (optional but useful)
router.patch('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body; // 'admin' | 'user'
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!['admin','user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const user = await User.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, user });
});

// --- Delete user (also optionally clean up their gematrias/entries)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  // Optional: cascade
  await Gematria.deleteMany({ userId: id }).catch(()=>{});
  await Entry.deleteMany({ userId: id }).catch(()=>{});
  const out = await User.findByIdAndDelete(id);
  if (!out) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// --- Delete a gematria
router.delete('/gematrias/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  const out = await Gematria.findByIdAndDelete(id);
  if (!out) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// --- Delete an entry
router.delete('/entries/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  const out = await Entry.findByIdAndDelete(id);
  if (!out) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
