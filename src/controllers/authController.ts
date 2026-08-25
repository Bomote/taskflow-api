import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.ts';

const rawJwtSecret = process.env.JWT_SECRET;

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

const jwtSecret: string = rawJwtSecret;

if (!jwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function registerUser(req: Request, res: Response): Promise<Response> {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const createdUser = await User.create({ name, email, password });

    return res.status(201).json({
      success: true,
      message: `User ${createdUser.name} created`,
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function loginUser(req: Request, res: Response): Promise<Response> {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email }).select('+password');

    if (!existingUser) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
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
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}