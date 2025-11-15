import { pool } from '../lib/db.js';
import { getPresignedPut, getPresignedGet, deleteObject } from '../middleware/attachments.js';
import crypto from 'crypto';

/**
 * POST /api/uploads/presign
 * Body: { filename, contentType, batch_id, kind? }
**/
export async function presignUpload(req, res) {
  try {
    const user = req.user;
    const { filename, contentType, batch_id, kind } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename required' });

    if (batch_id) {
      const { rows } = await pool.query('SELECT id, farmer_id FROM batch WHERE id = $1', [batch_id]);
      if (!rows[0]) return res.status(404).json({ error: 'batch not found' });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '-');
    const prefix = batch_id ? `uploads/${batch_id}` : `uploads/misc`;
    const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const { url } = await getPresignedPut(key, contentType, 300);

    return res.json({ url, key });
  } catch (err) {
    console.error('presignUpload error', err);
    return res.status(500).json({ error: 'Failed to create presign' });
  }
}

/**
 * POST /api/uploads/complete
 * Body: { key, batch_id, kind?, mime_type?, metadata? }
 * Called after successful PUT to S3 to persist attachment row
**/
export async function uploadComplete(req, res) {
  try {
    const user = req.user;
    const { key, batch_id, kind = 'other', mime_type = null, metadata = null } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

    const { rows: batchRows } = await pool.query('SELECT id FROM batch WHERE id = $1', [batch_id]);
    if (!batchRows[0]) return res.status(404).json({ error: 'batch not found' });

    const { rows } = await pool.query(
      `INSERT INTO attachment (batch_id, uploaded_by, kind, url, mime_type, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, batch_id, uploaded_by, kind, url, mime_type, metadata, created_at`,
      [batch_id, user.id, kind, key, mime_type, metadata ? JSON.stringify(metadata) : '{}']
    );

    const attachment = rows[0];

    return res.status(201).json({ attachment });
  } catch (err) {
    console.error('uploadComplete error', err);
    return res.status(500).json({ error: 'Failed to complete upload' });
  }
}

/**
 * GET /api/batches/:id/attachments
**/
export async function getAttachmentsByBatch(req, res) {
  try {
    const { id } = req.params;
    const { rows: b } = await pool.query('SELECT id, farmer_id FROM batch WHERE id = $1', [id]);
    if (!b[0]) return res.status(404).json({ error: 'batch not found' });

    const { rows } = await pool.query(
      'SELECT id, batch_id, uploaded_by, kind, url, mime_type, metadata, created_at FROM attachment WHERE batch_id = $1 ORDER BY created_at DESC',
      [id]
    );
    return res.json({ attachments: rows });
  } catch (err) {
    console.error('getAttachmentsByBatch error', err);
    return res.status(500).json({ error: 'Failed to fetch attachments' });
  }
}

/**
 * GET /api/attachments/:id
 * returns metadata + presigned GET url to download/view file
**/
export async function getAttachment(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT id, batch_id, uploaded_by, kind, url, mime_type, metadata, created_at FROM attachment WHERE id = $1', [id]);
    const a = rows[0];
    if (!a) return res.status(404).json({ error: 'attachment not found' });

    const presigned = await getPresignedGet(a.url, 300);
    return res.json({ attachment: a, url: presigned });
  } catch (err) {
    console.error('getAttachment error', err);
    return res.status(500).json({ error: 'Failed to fetch attachment' });
  }
}

/**
 * DELETE /api/attachments/:id
 * Only uploader can delete. Also delete object from S3.
**/
export async function deleteAttachment(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const { rows } = await pool.query('SELECT id, uploaded_by, url, batch_id FROM attachment WHERE id = $1', [id]);
    const a = rows[0];
    if (!a) return res.status(404).json({ error: 'attachment not found' });

    if (!(a.uploaded_by === user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      await deleteObject(a.url);
    } catch (err) {
      console.warn('warning: failed to delete object from S3', err);
    }

    await pool.query('DELETE FROM attachment WHERE id = $1', [id]);
    return res.status(204).end();
  } catch (err) {
    console.error('deleteAttachment error', err);
    return res.status(500).json({ error: 'Failed to delete attachment' });
  }
}
