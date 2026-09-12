import type { Response } from 'express';

export const ERR_CODES = {
  INVALID_CREDENTIALS: { status: 401, message: 'Wrong password or unknown email' },
  EMAIL_ALREADY_REGISTERED: { status: 409, message: 'Email already exists' },
  TASK_NOT_FOUND: { status: 404, message: 'Task not found' },
  INVALID_ID: { status: 400, message: 'Invalid ID format' },
  VALIDATION_ERROR: { status: 400, message: 'Validation failed' },
  UNAUTHORIZED: { status: 401, message: 'Invalid or missing token' },
  ROUTE_NOT_FOUND: { status: 404, message: 'Unknown route' },
  INTERNAL_ERROR: { status: 500, message: 'Unexpected internal error' },
} as const;

type ErrorKey = keyof typeof ERR_CODES;

type ValidationDetail = {
  field: string;
  message: string;
};

export function sendError(
  res: Response,
  key: ErrorKey,
  details?: ValidationDetail[]
) {
  const { status, message } = ERR_CODES[key];
  return res.status(status).json({
    success: false,
    error: { code: key, message, ...(details ? { details } : {}) },
  });
}