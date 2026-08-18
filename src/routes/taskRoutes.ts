import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask,
} from '../controllers/taskController.ts';

const taskRouter = Router();

taskRouter.get('/', getTasks);
taskRouter.post('/', createTask);
taskRouter.get('/:id', getTaskById);
taskRouter.put('/:id', updateTask);
taskRouter.delete('/:id', deleteTask);

export default taskRouter;