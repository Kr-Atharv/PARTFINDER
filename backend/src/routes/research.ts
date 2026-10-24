// src/routes/research.ts
import { Router } from "express";
import { ResearchController } from "../controllers/researchController";
import { validateBody } from "../middleware/validation";
import { researchSearchRequestSchema } from "../schemas/researchSchemas";

const router = Router();

// POST /api/research/search
router.post("/search", validateBody(researchSearchRequestSchema), ResearchController.search);

// POST /api/research/stream  (same pipeline, streams real progress as NDJSON)
router.post("/stream", validateBody(researchSearchRequestSchema), ResearchController.stream);

export default router;
