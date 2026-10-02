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

  if (
    err &&
    typeof err === 'object' &&
    (('type' in err && (err as any).type === 'entity.too.large') ||
     ('status' in err && (err as any).status === 413))
  ) {
    return sendError(res, 'PAYLOAD_TOO_LARGE');
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${req.id}]`, err);
  }
  return sendError(res, 'INTERNAL_ERROR', undefined, { requestId: req.id });
}