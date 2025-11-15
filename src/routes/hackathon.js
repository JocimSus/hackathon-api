import { Router } from "express";
import { createPutPresign } from "../controllers/s3Controller.js";

const router = Router();

router.get("/health", async (req, res) => {
  return res.json({ status: "ok" });
});

router.post('/presign', async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename) return res.status(400).send('filename required');

  const result = await createPutPresign(filename, contentType);
  res.json(result);
});

// router.post("/upload-complete", async (req, res) => {
//   const { key } = req.body;
//   if (!key) return res.status(400).send('key required');

//   const result = await completeUpload(key);
//   res.json(result);
// });

export default router;
