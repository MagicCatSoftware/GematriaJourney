// server/middleware/roles.js
export function requireAuthOnly(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'unauthenticated' });
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  if (req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'forbidden', message: 'Admin required' });
}

export function requirePaidOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  if (req.user.role === 'admin') return next();
  if (req.user.isLifetime) return next();
  return res.status(403).json({
    error: 'payment_required',
    message: 'Lifetime membership required to access this feature.'
  });
}