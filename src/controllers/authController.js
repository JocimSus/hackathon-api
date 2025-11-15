import bcrypt from 'bcrypt';
import { pool } from '../lib/db.js';
import { signToken } from '../utils/jwt.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { rows } = await pool.query('SELECT id, email, password_hash, name, phone, role FROM app_user WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    res.cookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60
    });

    const safe = { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
    res.json({ token, user: safe });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Failed to login' });
  }
}

export async function logout(req, res) {
  res.clearCookie('session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return res.status(204).end();
}

export async function me(req, res) {
  try {
    const token = req.cookies?.session || req.headers?.authorization?.split?.(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = require('../utils/jwt.js').verifyToken(token);
    if (!payload?.sub) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await pool.query('SELECT id, email, name, phone, role, created_at FROM app_user WHERE id = $1', [payload.sub]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    res.json({ user });
  } catch (err) {
    console.error('me error', err);
    res.status(500).json({ error: 'Failed' });
  }
}
