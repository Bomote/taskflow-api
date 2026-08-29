import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

type AuthenticatedUser = JwtPayload & {
  id: string;
}

function isAuthenticatedUser(
  user: string | JwtPayload | undefined,
): user is AuthenticatedUser {
  return (
    typeof user === "object" &&
    user !== null && 
    typeof (user as JwtPayload).id === "string"
  );
}

const rawJwtSecret = process.env.JWT_SECRET;

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

const jwtSecret: string = rawJwtSecret;

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
    req.user = jwt.verify(token, jwtSecret);
    if(!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }
  
  if (!isAuthenticatedUser(req.user)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized or malformed token",
    });
  }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }
}