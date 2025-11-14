import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  res.json({msg: "Hello World"});
});

export default router;
