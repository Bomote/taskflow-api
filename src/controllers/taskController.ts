import type { Request, Response } from 'express';
import { Task } from '../models/Task.ts';
import { sendError } from '../utils/errorCodes.ts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id);
}

export async function getTasks(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED');
  }

  try {
    const taskList = await Task.find({ userId: req.user.id });
    return res.status(200).json({ success: true, data: taskList });
  } catch (error) {
    console.error(error)
    return sendError(res, 'INTERNAL_ERROR');
  }
}

export async function createTask(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED');
  }

  const { title, description, status } = req.body;

  try {
    const createdTask = await Task.create({
      title,
      description,
      status,
      userId: req.user.id,
    });
    return res.status(201).json({ success: true, data: createdTask });
  } catch (error) {
    console.error(error)
    return sendError(res, 'INTERNAL_ERROR');
  }
}

export async function getTaskById(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED');
  }

  const { id: taskId } = req.params;

  if (!isValidObjectId(taskId)) {
    return sendError(res, 'INVALID_ID');
  }

  try {
    const task = await Task.findOne({ _id: taskId, userId: req.user.id });

    if (!task) {
      return sendError(res, 'TASK_NOT_FOUND')
    }

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error(error)
    return sendError(res, 'INTERNAL_ERROR');
  }
}

export async function updateTask(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED')
  }

  const { id: taskId } = req.params;

  if (!isValidObjectId(taskId)) {
    return sendError(res, 'INVALID_ID')
  }

  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, userId: req.user.id },
      req.body,
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedTask) {
      return sendError(res, 'TASK_NOT_FOUND')
    }

    return res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    console.error(error);
    return sendError(res, 'INTERNAL_ERROR');
  }
}

export async function deleteTask(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED')
  }

  const { id: taskId } = req.params;

  if (!isValidObjectId(taskId)) {
    return sendError(res, 'INVALID_ID')
  }

  try {
    const deletedTask = await Task.findOneAndDelete({ _id: taskId, userId: req.user.id });

    if (!deletedTask) {
      return sendError(res, 'TASK_NOT_FOUND')
    }

    return res.status(200).json({ success: true, data: deletedTask });
  } catch (error) {
    console.error(error);
    return sendError(res, 'INTERNAL_ERROR');
  }
}