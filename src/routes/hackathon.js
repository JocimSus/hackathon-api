import { Router } from "express";
import { check } from "../lib/controller.js";

const router = Router();

router.get("/", async (req, res) => {
  check(req, res);
  res.json({ msg: "Hello World" });
});

export default router;
