// src/routes/crossReference.ts
import { Router } from "express";
import { CrossReferenceController } from "../controllers/crossReferenceController";

const router = Router();

router.post("/match", CrossReferenceController.lookup);
router.get("/match", CrossReferenceController.lookup);
router.get("/:partId", CrossReferenceController.getByPartId);

export default router;
