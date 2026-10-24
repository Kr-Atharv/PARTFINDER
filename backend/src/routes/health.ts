// src/routes/health.ts
import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

export default router;
