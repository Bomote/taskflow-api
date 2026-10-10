import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

const requestIdRegex = /^[a-zA-Z0-9._-]{1,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers['x-request-id'];

  const acceptedId = typeof incomingId === 'string' && requestIdRegex.test(incomingId) ? incomingId : undefined;

  req.id = acceptedId || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}