import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

interface CustomRequest extends Request {
  user?: string | JwtPayload;
}

const rawJwtSecret = process.env.JWT_SECRET;

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

const jwtSecret: string = rawJwtSecret;

export async function protectRoute (req: CustomRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization']

    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({success: false, error: "Unauthorized or Malformed Token"})
    }

    const token = authHeader.split(' ')[1] || ""

    try {
        const verifiedToken = jwt.verify(token, jwtSecret)
        
        req.user = verifiedToken
    } catch (error) {
        return res.status(401).json({success: false, error: "Unauthorized or Malformed Token"})    
    }

    next()
}