// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { logger } from "./utils/logger";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import partsRouter from "./routes/parts";
import compatibilityRouter from "./routes/compatibility";
import researchRouter from "./routes/research";
import protectedRouter from "./routes/protected";
import visionRouter from "./routes/vision";
import crossReferenceRouter from "./routes/crossReference";
import datasheetRouter from "./routes/datasheet";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Body parsing (allow base64 uploads for images and datasheets)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Cookie parser
app.use(cookieParser());

// CORS – whitelist origins from env
const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// Simple request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/parts", partsRouter);
app.use("/api/compatibility", compatibilityRouter);
app.use("/api/research", researchRouter);
app.use("/api/protected", protectedRouter);
app.use("/api/vision", visionRouter);
app.use("/api/cross-reference", crossReferenceRouter);
app.use("/api/datasheets", datasheetRouter);

// Centralized error handling – must be after routes
app.use(errorHandler);

export default app;
