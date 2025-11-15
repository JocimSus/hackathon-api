import { verifyToken } from '../utils/jwt.js';
import { pool } from '../lib/db.js';

export async function getAuthUser(req) {
  const token = req.cookies?.session || req.headers?.authorization?.split?.(' ')[1];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub) return null;

  const { rows } = await pool.query(
    'SELECT id, email, role, name, phone, created_at FROM app_user WHERE id = $1',
    [payload.sub]
  );
  return rows[0] ?? null;
}

export function requireAuth() {
  return async (req, res, next) => {
    try {
      const user = await getAuthUser(req);
      if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      next();
    } catch (err) {
      console.error('auth middleware error', err);
      res.status(500).json({ error: 'Internal auth error' });
    }
  };
}
