// src/routes/vision.ts
import { Router } from "express";
import { VisionController } from "../controllers/visionController";

const router = Router();

router.post("/ocr", VisionController.scan);

export default router;
