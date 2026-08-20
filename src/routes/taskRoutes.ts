import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask,
} from '../controllers/taskController.ts';
import { createTaskSchema, updateTaskSchema, validateRequest } from '../utils/validators.ts';

const taskRouter = Router();

taskRouter.get('/', getTasks);
taskRouter.post('/', validateRequest(createTaskSchema), createTask);
taskRouter.get('/:id', getTaskById);
taskRouter.put('/:id', validateRequest(updateTaskSchema), updateTask);
taskRouter.delete('/:id', deleteTask);

export default taskRouter;