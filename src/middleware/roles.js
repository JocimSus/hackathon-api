export function requireRole(allowed = []) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(allowed) || allowed.length === 0) return next();
    if (allowed.includes(user.role)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}
