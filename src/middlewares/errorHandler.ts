import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/errorCodes.ts';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, 'VALIDATION_ERROR', details);
  }

  console.error(`[${req.id}]`, err);
  return sendError(res, 'INTERNAL_ERROR', undefined, { requestId: req.id });
}