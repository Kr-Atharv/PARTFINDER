// src/routes/auth.ts
import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { validateBody } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";
import { signUpSchema, signInSchema, refreshTokenSchema } from "../schemas/authSchemas";

const router = Router();

router.post("/signup", validateBody(signUpSchema), AuthController.signUp);
router.post("/signin", validateBody(signInSchema), AuthController.signIn);
router.post("/refresh", validateBody(refreshTokenSchema), AuthController.refresh);
router.post("/signout", AuthController.signOut);
router.get("/me", requireAuth, AuthController.getMe);

export default router;
