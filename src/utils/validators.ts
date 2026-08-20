import z from "zod";
import type { Request, Response, NextFunction } from "express";

const createTaskSchema = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    status: z.enum(["pending", "in-progress", "completed"]).optional(),
})

const updateTaskSchema = createTaskSchema.partial()

export function validateSchema(schema: z.ZodSchema) {
    const validation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsedSchema = await schema.parseAsync(req.body)

            if (parsedSchema){  
                req.body = parsedSchema
            }
            next()
        } catch (error) {
            next(error)
        }
    }
    return validation
}

export { createTaskSchema, updateTaskSchema }