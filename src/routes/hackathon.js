import { Router } from "express";
import { check } from "../lib/controller.js";

const router = Router();

router.get("/", async (req, res) => {
  check(req, res);
  res.json({ msg: "We do a little trolling" });
});

export default router;
