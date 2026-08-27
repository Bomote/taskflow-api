import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const createTaskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).optional(),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain one uppercase letter")
  .regex(/[a-z]/,"Must contain one lowercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character")
})

export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
})

export const updateTaskSchema = createTaskSchema.partial();

export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}