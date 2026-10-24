// src/routes/parts.ts
import { Router } from "express";
import { PartsController } from "../controllers/partsController";
import { validateQuery, validateParams } from "../middleware/validation";
import {
  searchPartsQuerySchema,
  comparePartsQuerySchema,
  partIdParamSchema,
  suggestQuerySchema,
} from "../schemas/partsSchemas";

const router = Router();

// GET /api/parts/search
router.get("/search", validateQuery(searchPartsQuerySchema), PartsController.search);

// GET /api/parts/compare?ids=...
router.get("/compare", validateQuery(comparePartsQuerySchema), PartsController.compare);

// GET /api/parts/suggest?q=...  (autocomplete from real catalogue records)
router.get("/suggest", validateQuery(suggestQuerySchema), PartsController.suggest);

// GET /api/parts/facets  (distinct manufacturers, categories, spec labels with counts)
router.get("/facets", PartsController.facets);

// GET /api/parts/popular  (most frequent recorded searches)
router.get("/popular", PartsController.popular);

// GET /api/parts/:id  (must stay after the fixed routes above)
router.get("/:id", validateParams(partIdParamSchema), PartsController.getById);

export default router;
