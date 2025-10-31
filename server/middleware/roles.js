export function requireRole(role = 'admin') {
  return (req, res, next) => {
    const me = req.user;
    if (!me) return res.status(401).json({ error: 'Auth required' });
    if (me.role !== role) return res.status(403).json({ error: 'Admin only' });
    next();
  };
}

export function requirePaid(req, res, next) {
  const me = req.user;
  if (!me) return res.status(401).json({ error: 'Auth required' });
  // Support either boolean "isPaid" or your existing "isLifetime"
  const ok = me.isPaid || me.isLifetime;
  if (!ok) return res.status(402).json({ error: 'Payment required' }); // 402 semantically fits
  next();
}