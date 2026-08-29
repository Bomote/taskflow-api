import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { AuthenticatedUser } from '../types/express.js';

const rawJwtSecret = process.env.JWT_SECRET;

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

const jwtSecret: string = rawJwtSecret;

function isAuthenticatedUser(
  payload: string | JwtPayload
): payload is AuthenticatedUser {
  return typeof payload === 'object' && payload !== null && typeof payload.id === 'string';
}

export function protect(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (!isAuthenticatedUser(decoded)) {
      return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }
}