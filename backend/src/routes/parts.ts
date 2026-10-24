// src/routes/parts.ts
import { Router } from "express";
import { PartsController } from "../controllers/partsController";
import { validateQuery, validateParams } from "../middleware/validation";
import {
  searchPartsQuerySchema,
  comparePartsQuerySchema,
  partIdParamSchema,
} from "../schemas/partsSchemas";

const router = Router();

// GET /api/parts/search
router.get("/search", validateQuery(searchPartsQuerySchema), PartsController.search);

// GET /api/parts/compare?ids=...
router.get("/compare", validateQuery(comparePartsQuerySchema), PartsController.compare);

// GET /api/parts/:id
router.get("/:id", validateParams(partIdParamSchema), PartsController.getById);

export default router;
