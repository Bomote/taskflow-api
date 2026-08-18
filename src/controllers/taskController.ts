import type { Request, Response } from 'express';
import { Task } from '../models/Task.ts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function getTasks(req: Request, res: Response): Promise<Response> {
  try {
    const taskList = await Task.find();
    return res.status(200).json({ success: true, data: taskList });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createTask(req: Request, res: Response): Promise<Response> {
  const { title, description, status } = req.body;

  try {
    const createdTask = await Task.create({ title, description, status });
    return res.status(201).json({ success: true, data: createdTask });
  } catch (error) {
    return res.status(400).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getTaskById(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (typeof id !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }
  const validIdFormat = /^[0-9a-fA-F]{24}$/.test(id);

  if (!validIdFormat) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  try {
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateTask(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (typeof id !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }
  const validIdFormat = /^[0-9a-fA-F]{24}$/.test(id);

  if (!validIdFormat) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  try {
    const updatedTask = await Task.findByIdAndUpdate(id, req.body, {
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
  const { id } = req.params;
  if (typeof id !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }
  const validIdFormat = /^[0-9a-fA-F]{24}$/.test(id);

  if (!validIdFormat) {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  try {
    const deletedTask = await Task.findByIdAndDelete(id);

    if (!deletedTask) {
      return res.status(404).json({ success: false, message: 'No such task exists' });
    }

    return res.status(200).json({ success: true, data: deletedTask });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}