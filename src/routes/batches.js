import { Router } from 'express';
import {
  createBatch, listBatches, getBatch, updateBatch, getBatchHistory
} from '../controllers/batchController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

router.use(requireAuth());
router.post('/', requireRole(['farmer']), createBatch);
router.get('/', listBatches);
router.get('/:id', getBatch);
router.patch('/:id', updateBatch);
router.get('/:id/history', getBatchHistory);

export default router;
