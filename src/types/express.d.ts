import type { JwtPayload } from 'jsonwebtoken';

export type AuthenticatedUser = JwtPayload & { id: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};