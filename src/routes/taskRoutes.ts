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

/**
 * @openapi
 * /api/tasks:
 *   get:
 *     summary: List the caller's tasks
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of the caller's tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Missing or invalid token
 */
taskRouter.get('/', protect, getTasks);

/**
 * @openapi
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed]
 *     responses:
 *       201:
 *         description: Task created
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Missing or invalid token
 */
taskRouter.post('/', protect, validateRequest(createTaskSchema), createTask);

/**
 * @openapi
 * /api/tasks/{id}:
 *   get:
 *     summary: Fetch one of the caller's tasks by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The requested task
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: Task not found
 */
taskRouter.get('/:id', protect, getTaskById);

/**
 * @openapi
 * /api/tasks/{id}:
 *   put:
 *     summary: Update one of the caller's tasks
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed]
 *     responses:
 *       200:
 *         description: Task updated
 *       400:
 *         description: Invalid ID format or validation failed
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: Task not found
 */
taskRouter.put('/:id', protect, validateRequest(updateTaskSchema), updateTask);

/**
 * @openapi
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete one of the caller's tasks
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: Task not found
 */
taskRouter.delete('/:id', protect, deleteTask);

export default taskRouter;