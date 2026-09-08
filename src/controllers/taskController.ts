import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Task } from '../models/Task.ts';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id);
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getTasks(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  try {
    const page = Number(req.query.page ?? DEFAULT_PAGE);
    const requestedLimit = Number(req.query.limit ?? DEFAULT_LIMIT);

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return res
        .status(400)
        .json({ success: false, error: 'Query parameters "page" and "limit" must be positive integers' });
    }

    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const filter = { userId: req.user.id };

    const [total, taskList] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.status(200).json({
      success: true,
      data: taskList,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

export async function createTask(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
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
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

export async function getTaskById(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  const { id: taskId } = req.params;

  if (!isValidObjectId(taskId)) {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }

  try {
    const task = await Task.findOne({ _id: taskId, userId: req.user.id });

    if (!task) {
      return res.status(404).json({ success: false, error: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

export async function updateTask(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  const { id: taskId } = req.params;

  if (!isValidObjectId(taskId)) {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must not be empty' });
  }

  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, userId: req.user.id },
      req.body,
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

export async function deleteTask(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized or malformed token' });
  }

  const { id: taskId } = req.params;

  if (!isValidObjectId(taskId)) {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }

  try {
    const deletedTask = await Task.findOneAndDelete({ _id: taskId, userId: req.user.id });

    if (!deletedTask) {
      return res.status(404).json({ success: false, error: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: deletedTask });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}