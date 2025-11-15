import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  presignUpload,
  uploadComplete,
  getAttachmentsByBatch,
  getAttachment,
  deleteAttachment
} from '../controllers/attachmentController.js';

const router = Router();

router.use(requireAuth());
router.post('/presign', presignUpload);
router.post('/complete', uploadComplete);
router.get('/batches/:id', getAttachmentsByBatch);
router.get('/:id', getAttachment);
router.delete('/:id', deleteAttachment);

export default router;
