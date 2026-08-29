import type { Request, Response } from 'express';
import { Task } from '../models/Task.ts';
import type { JwtPayload } from 'jsonwebtoken';

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id);
}

export async function getTasks(req: Request, res: Response): Promise<Response> {
  if(!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  if (!isAuthenticatedUser(req.user)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized or malformed token",
    });
  }

  try {
    const { id: userId } = req.user;
    const taskList = await Task.find({ userId });
    return res.status(200).json({ success: true, data: taskList });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createTask(req: Request, res: Response): Promise<Response> {
  const { title, description, status } = req.body;

  if(!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  if (!isAuthenticatedUser(req.user)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized or malformed token",
    });
  }

  const { id: userId } = req.user;

  try {
    const createdTask = await Task.create({ title, description, status, userId });
    return res.status(201).json({ success: true, data: createdTask });
  } catch (error) {
    return res.status(400).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getTaskById(req: Request, res: Response): Promise<Response> {
  if(!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  if (!isAuthenticatedUser(req.user)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized or malformed token",
    });
  }

  const { id: taskId } = req.params;
  const { id: userId } = req.user;

  if (!isValidObjectId(taskId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  try {
    const task = await Task.findOne({ _id: taskId, userId });

    if (!task) {
      return res.status(404).json({ success: false, message: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateTask(req: Request, res: Response): Promise<Response> {
  if(!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  if (!isAuthenticatedUser(req.user)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized or malformed token",
    });
  }

  const { id: taskId } = req.params;
  const { id: userId } = req.user;

  if (!isValidObjectId(taskId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  try {
    const updatedTask = await Task.findOneAndUpdate({ _id: taskId, userId }, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedTask) {
      return res.status(404).json({ success: false, message: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    return res.status(400).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function deleteTask(req: Request, res: Response): Promise<Response> {
  if(!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }
  
  if (!isAuthenticatedUser(req.user)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized or malformed token",
    });
  }
  
  const { id: taskId } = req.params;
  const { id: userId } = req.user;

  if (!isValidObjectId(taskId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  try {
    const deletedTask = await Task.findOneAndDelete({ _id: taskId, userId });

    if (!deletedTask) {
      return res.status(404).json({ success: false, message: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: deletedTask });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}