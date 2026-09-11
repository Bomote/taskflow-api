import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.ts';
import { sendError } from '../utils/errorCodes.ts';

const rawJwtSecret = process.env.JWT_SECRET;

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

const jwtSecret: string = rawJwtSecret;


export async function registerUser(req: Request, res: Response): Promise<Response> {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return sendError(res, 'EMAIL_ALREADY_REGISTERED');
    }

    const createdUser = await User.create({ name, email, password });

    return res.status(201).json({
      success: true,
      message: `User ${createdUser.name} created`,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      console.error(error);
      return sendError(res, 'EMAIL_ALREADY_REGISTERED');
    }
    console.error(error)
    return sendError(res, 'INTERNAL_ERROR');
  }
}

export async function loginUser(req: Request, res: Response): Promise<Response> {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email }).select('+password');

    if (!existingUser) {
      return sendError(res, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return sendError(res, 'INVALID_CREDENTIALS');
    }

    const token = jwt.sign({ id: existingUser._id }, jwtSecret, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    return res.status(200).json({
      success: true,
      data: { token },
    });
  } catch (error) {
    console.error(error)
    return sendError(res, 'INTERNAL_ERROR');
  }
}