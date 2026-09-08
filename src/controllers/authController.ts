import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.ts';

const rawJwtSecret = process.env.JWT_SECRET;

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}

const jwtSecret: string = rawJwtSecret;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

export async function registerUser(req: Request, res: Response): Promise<Response> {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const createdUser = await User.create({ name, email, password });

    return res.status(201).json({
      success: true,
      message: `User ${createdUser.name} created`,
      data: { id: createdUser._id, name: createdUser.name, email: createdUser.email },
    });
  } catch (error) {
    // Covers the race where two concurrent registrations pass the
    // existence check above and collide on the unique index.
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

export async function loginUser(req: Request, res: Response): Promise<Response> {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email }).select('+password');

    if (!existingUser) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
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
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}