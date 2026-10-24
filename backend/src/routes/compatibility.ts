// src/routes/compatibility.ts
import { Router } from "express";
import { CompatibilityController } from "../controllers/compatibilityController";
import { validateBody } from "../middleware/validation";
import { compatibilityCheckRequestSchema } from "../schemas/compatibilitySchemas";

const router = Router();

// POST /api/compatibility/check
router.post(
  "/check",
  validateBody(compatibilityCheckRequestSchema),
  CompatibilityController.check
);

export default router;
