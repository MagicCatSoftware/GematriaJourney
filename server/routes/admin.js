// server/routes/admin.js
import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Gematria from '../models/Gematria.js';
import Entry from '../models/Entry.js';
import { requireAdmin } from '../middleware/roles.js';

const r = Router();

let founderIdCache = null;
async function getFounderId() {
  if (founderIdCache) return founderIdCache;
  const founder = await User.findOne({}, { _id: 1, createdAt: 1 }).sort({ createdAt: 1 }).lean();
  founderIdCache = founder?._id?.toString() || null;
  return founderIdCache;
}

const sameId = (a, b) => String(a) === String(b);

async function forbidSelfOrFounder(req, res, next) {
  try {
    const targetId = req.params.id;
    const meId = req.user?._id;
    const founderId = await getFounderId();

    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ error: 'invalid_user_id' });
    }
    if (sameId(targetId, meId)) {
      return res.status(409).json({ error: 'cannot_modify_self' });
    }
    if (founderId && sameId(targetId, founderId)) {
      return res.status(409).json({ error: 'cannot_modify_founder' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

// GET /admin/overview -> { users, banned, gematrias, entries }
r.get('/overview', async (_req, res) => {
  const [users, banned, gematrias, entries] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isBanned: true }),
    Gematria.countDocuments({}),
    Entry.countDocuments({}),
  ]);
  res.json({ users, banned, gematrias, entries });
});

// GET /admin/users?q=... -> { users: [...] }
r.get('/users', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const find = q
    ? { $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] }
    : {};
  const users = await User.find(find)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  res.json({ users });
});

// PATCH /admin/users/:id/role { role: 'admin' | 'user' } -> { ok:true }
r.patch('/users/:id/role', forbidSelfOrFounder, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });

  await User.findByIdAndUpdate(id, { role }, { new: false });
  res.json({ ok: true });
});

// PATCH /admin/users/:id/ban { ban: boolean } -> { ok:true }
r.patch('/users/:id/ban',forbidSelfOrFounder, async (req, res) => {
  const { id } = req.params;
  const { ban } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });

  await User.findByIdAndUpdate(id, { isBanned: !!ban }, { new: false });
  res.json({ ok: true });
});

// DELETE /admin/users/:id -> { ok:true }
// Also remove their entries/gematrias (light cascade)
r.delete('/users/:id',forbidSelfOrFounder, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });

  await Promise.all([
    Entry.deleteMany({ owner: id }),
    Gematria.deleteMany({ createdBy: id }),
    User.findByIdAndDelete(id),
  ]);
  res.json({ ok: true });
});

// DELETE /admin/gematrias/:id -> { ok:true }
r.delete('/gematrias/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });

  await Gematria.findByIdAndDelete(id);
  res.json({ ok: true });
});

// DELETE /admin/entries/:id -> { ok:true }
r.delete('/entries/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid_id' });

  await Entry.findByIdAndDelete(id);
  res.json({ ok: true });
});

export default r;
