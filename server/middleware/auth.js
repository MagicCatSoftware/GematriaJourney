import User from '../models/User.js';

/** Require login */
export function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'unauthenticated' });
}

/** Alias for legacy imports */
export const authRequired = ensureAuth;

/** Require admin role */
export function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden - admin only' });
  }
  next();
}

/** Require paid (isLifetime) or admin */
export function requirePaid(req, res, next) {
  if (!req.isAuthenticated || !req.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  if (!req.user.isLifetime && req.user.role !== 'admin') {
    return res.status(402).json({ error: 'payment required' });
  }
  next();
}

/** Reject banned users */
export function rejectBanned(req, res, next) {
  if (!req.isAuthenticated || !req.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  if (req.user.isBanned) {
    return res.status(403).json({ error: 'forbidden - user banned' });
  }
  next();
}

/** Reload the latest user data */
export async function reloadUser(req, res, next) {
  if (!req.user?._id) return next();
  try {
    const u = await User.findById(req.user._id);
    if (u) req.user = u;
  } catch (e) {
    console.error('reloadUser error:', e);
  }
  next();
}