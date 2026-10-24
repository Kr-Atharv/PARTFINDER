// src/routes/protected.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/dashboard", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    data: {
      message: "Welcome to PartFinder protected dashboard",
      user,
    },
  });
});

export default router;
