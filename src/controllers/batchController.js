import { pool } from '../lib/db.js';
import crypto from 'crypto';

function genQrText() {
  return `BATCH:${crypto.randomUUID()}`;
}

/**
 * POST /batches
 * Body: { qr_code?, catch_time?, metadata? }
 * Auth: authenticated (farmer only)
**/
export async function createBatch(req, res) {
  try {
    const user = req.user;
    const { qr_code, catch_time, metadata } = req.body;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!['farmer'].includes(user.role)) {
      return res.status(403).json({ error: 'Only farmers can create batches' });
    }

    const qrText = qr_code ? qr_code : genQrText();
    const farmerId = user.id;
    console.log(`User: ${user}`)
    console.log('Creating batch for farmer:', farmerId);
    const meta = metadata ? JSON.stringify(metadata) : '{}';

    const insertBatchSql = `
      INSERT INTO batch (qr_code, farmer_id, catch_time, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING id, qr_code, farmer_id, catch_time, metadata, created_at
    `;
    const rows = await pool.query(insertBatchSql, [qrText, farmerId, catch_time, meta]);
    const batch = rows[0];

    const eventPayload = { created_by: user.id, catch_time: catch_time, metadata: metadata || null };
    await pool.query(
      `INSERT INTO batch_event (batch_id, actor_id, actor_role, action, payload)
      VALUES ($1, $2, $3, $4, $5)`,
      [batch.id, user.id, user.role, 'created', eventPayload]
    );

    return res.status(201).json({ batch });
  } catch (err) {
    console.error('createBatch error', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'qr_code already exists' });
    }
    return res.status(500).json({ error: 'Failed to create batch' });
  }
}

/**
 * GET /batches
 * Query: ?page=&per_page=&farmer_id=&qr_code=
 * Auth: authenticated
**/
export async function listBatches(req, res) {
  try {
    const {
      page = 1,
      per_page = 10,
      farmer_id,
      qr_code,
      q
    } = req.query;

    const limit = parseInt(per_page, 10);
    const offset = ((parseInt(page, 10)) - 1) * limit;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (farmer_id) { conditions.push(`b.farmer_id = $${idx++}`); params.push(farmer_id); }
    if (qr_code) { conditions.push(`b.qr_code = $${idx++}`); params.push(qr_code); }
    if (q) {
      conditions.push(`(b.qr_code ILIKE $${idx} OR b.metadata::text ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        b.*,
        e_latest.latest_event
      FROM batch b
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'id', be.id,
          'action', be.action,
          'actor_id', be.actor_id,
          'actor_role', be.actor_role,
          'payload', be.payload,
          'created_at', be.created_at
        ) AS latest_event
        FROM batch_event be
        WHERE be.batch_id = b.id
        ORDER BY be.created_at DESC
        LIMIT 1
      ) e_latest ON true
      ${where}
      ORDER BY b.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(sql, params);
    return res.json({ data: rows, page: parseInt(page, 10), per_page: limit });
  } catch (err) {
    console.error('listBatches error', err);
    return res.status(500).json({ error: 'Failed to list batches' });
  }
}

/**
 * GET /batches/:id
 * Auth: authenticated (owner, or other roles in supply chain)
**/
export async function getBatch(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT b.*,
        (SELECT jsonb_build_object(
          'id', be.id, 'action', be.action, 'actor_id', be.actor_id, 'actor_role', be.actor_role, 'payload', be.payload, 'created_at', be.created_at
        ) FROM batch_event be WHERE be.batch_id = b.id ORDER BY be.created_at DESC LIMIT 1) AS latest_event
      FROM batch b
      WHERE b.id = $1`,
      [id]
    );
    const batch = rows[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    return res.json({ batch });
  } catch (err) {
    console.error('getBatch error', err);
    return res.status(500).json({ error: 'Failed to get batch' });
  }
}

/**
 * PATCH /batches/:id
 * Body: { catch_time?, metadata? }
 * Auth: owner, or other roles in supply chain
**/
export async function updateBatch(req, res) {
  try {
    const { id } = req.params;
    const { catch_time, metadata } = req.body;
    const user = req.user;

    const { rows } = await pool.query('SELECT id, farmer_id FROM batch WHERE id = $1', [id]);
    const batch = rows[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const fields = [];
    const params = [];
    let idx = 1;
    if (catch_time !== undefined) { fields.push(`catch_time = $${idx++}`); params.push(catch_time); }
    if (metadata !== undefined) { fields.push(`metadata = $${idx++}`); params.push(JSON.stringify(metadata)); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const sql = `UPDATE batch SET ${fields.join(', ')} WHERE id = $${idx++} RETURNING id, qr_code, farmer_id, catch_time, metadata, created_at`;
    params.push(id);

    const { rows: updated } = await pool.query(sql, params);
    const updatedBatch = updated[0];

    await pool.query(
      `INSERT INTO batch_event (batch_id, actor_id, actor_role, action, payload)
      VALUES ($1, $2, $3, $4, $5)`,
      [id, user.id, user.role, 'updated', { catch_time: catch_time, metadata: metadata || null }]
    );

    return res.json({ batch: updatedBatch });
  } catch (err) {
    console.error('updateBatch error', err);
    return res.status(500).json({ error: 'Failed to update batch' });
  }
}

/**
 * GET /batches/:id/history
 * Query: ?page=&per_page=&role=&action=&start_at=&end_at=
 * Auth: authenticated (owner, or other roles in supply chain)
**/
export async function getBatchHistory(req, res) {
  try {
    const { id } = req.params;
    const {
      page = 1,
      per_page = 10,
      role,
      action,
      start_at,
      end_at
    } = req.query;

    const limit = parseInt(per_page, 10);
    const offset = (parseInt(page, 10) - 1) * limit;

    const conditions = ['e.batch_id = $1'];
    const params = [id];
    let idx = 2;

    if (role) { conditions.push(`e.actor_role = $${idx++}`); params.push(role); }
    if (action) { conditions.push(`e.action = $${idx++}`); params.push(action); }
    if (start_at) { conditions.push(`e.created_at >= $${idx++}`); params.push(start_at); }
    if (end_at) { conditions.push(`e.created_at <= $${idx++}`); params.push(end_at); }

    const where = conditions.join(' AND ');

    const sql = `
      SELECT
        e.id, e.batch_id, e.actor_id, u.name AS actor_name, e.actor_role,
        e.action, e.payload, e.created_at
      FROM batch_event e
      LEFT JOIN app_user u ON u.id = e.actor_id
      WHERE ${where}
      ORDER BY e.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(sql, params);

    const { rows: attachments } = await pool.query(
      'SELECT id, kind, url, mime_type, uploaded_by, metadata, created_at FROM attachment WHERE batch_id = $1 ORDER BY created_at DESC',
      [id]
    );

    return res.json({ events: rows, attachments, page: parseInt(page, 10), per_page: limit });
  } catch (err) {
    console.error('getBatchHistory error', err);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
}
