import type { Request, Response } from 'express';
import { Task } from '../models/Task.ts';
import { sendError } from '../utils/errorCodes.ts';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id);
}

export async function getTasks(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED');
  }

  if (!req.pagination) {
    return sendError(res, 'INTERNAL_ERROR');
  }

  const { page, limit } = req.pagination;
  const skip = (page - 1) * limit;

  try {
    const [tasks, total] = await Promise.all([
      Task.find({ userId: req.user.id }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      Task.countDocuments({ userId: req.user.id }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: tasks,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    console.error(error);
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

  if (Object.keys(req.body).length === 0) {
    return sendError(res, 'EMPTY_UPDATE');
  }

  try {
    const { title, description, status } = req.body;
    const allowedUpdates = Object.fromEntries(
      Object.entries({ title, description, status }).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(allowedUpdates).length === 0) {
      return sendError(res, 'EMPTY_UPDATE');
    }

    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, userId: req.user.id },
      allowedUpdates,
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