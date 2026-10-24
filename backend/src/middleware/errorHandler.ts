// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  const status = err.status ?? 500;
  const code = err.code ?? "INTERNAL_ERROR";
  logger.error(`${err.message} (status=${status}, code=${code})`);
  res.status(status).json({ error: { message: err.message, code } });
};
