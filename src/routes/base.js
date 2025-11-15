import { Router } from "express";

const router = Router();

router.get("/health", async (req, res) => {
  return res.json({ status: "ok" });
});

export default router;
