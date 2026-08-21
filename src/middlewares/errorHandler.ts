import type { Request, Response, NextFunction } from "express";
import z from "zod";

export function errorHandler (err: unknown, req: Request, res: Response, next: NextFunction){
      if (err instanceof z.ZodError) {
        res.status(400).json({success: false, error: "Validation Failed", details: err.errors})
      } else {
        console.error(err)
        res.status(500).json({success: false, error: "Internal Server Error"})
      }
}