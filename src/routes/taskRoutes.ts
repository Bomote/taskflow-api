import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask,
} from '../controllers/taskController.ts';
import { createTaskSchema, updateTaskSchema, validateRequest } from '../utils/validators.ts';
import { protect } from '../middlewares/protect.ts';

const taskRouter = Router();

taskRouter.get('/', protect, getTasks);
taskRouter.post('/', protect, validateRequest(createTaskSchema), createTask);
taskRouter.get('/:id', protect, getTaskById);
taskRouter.put('/:id', protect, validateRequest(updateTaskSchema), updateTask);
taskRouter.delete('/:id', protect, deleteTask);

export default taskRouter;