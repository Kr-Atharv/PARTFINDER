// src/middleware/validation.ts
import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodEffects, ZodError } from "zod";

type SchemaType = AnyZodObject | ZodEffects<any>;

export const validateBody = (schema: SchemaType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details: error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
        });
      }
      next(error);
    }
  };
};

export const validateQuery = (schema: SchemaType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = (await schema.parseAsync(req.query)) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: {
            message: "Invalid query parameters",
            code: "VALIDATION_ERROR",
            details: error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
        });
      }
      next(error);
    }
  };
};

export const validateParams = (schema: SchemaType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = (await schema.parseAsync(req.params)) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: {
            message: "Invalid route parameters",
            code: "VALIDATION_ERROR",
            details: error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
        });
      }
      next(error);
    }
  };
};
