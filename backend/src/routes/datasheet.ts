// src/routes/datasheet.ts
import { Router } from "express";
import { DatasheetController } from "../controllers/datasheetController";

const router = Router();

router.post("/parse", DatasheetController.parse);

export default router;
