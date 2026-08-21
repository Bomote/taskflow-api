import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation Failed',
      details: err.issues,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
  });
}