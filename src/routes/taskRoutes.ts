import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask,
} from '../controllers/taskController.ts';
import { createTaskSchema, paginationQuerySchema, updateTaskSchema, validateQuery, validateRequest } from '../utils/validators.ts';
import { protect } from '../middlewares/protect.ts';

const taskRouter = Router();

/**
 * @openapi
 * /api/tasks:
 *   get:
 *     summary: List the caller's tasks (paginated)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 15
 *           default: 10
 *     responses:
 *       200:
 *         description: A paginated list of the caller's tasks, newest first
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskListResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
taskRouter.get('/', protect, validateQuery(paginationQuerySchema), getTasks);

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
 *           schema: { $ref: '#/components/schemas/CreateTaskRequest' }
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       413: { $ref: '#/components/responses/PayloadTooLarge' }
 *       500: { $ref: '#/components/responses/InternalError' }
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
 *       - $ref: '#/components/parameters/TaskId'
 *     responses:
 *       200:
 *         description: The requested task
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
taskRouter.get('/:id', protect, getTaskById);

/**
 * @openapi
 * /api/tasks/{id}:
 *   put:
 *     summary: Update one of the caller's tasks
 *     description: Partial update. At least one of title, description or status is required.
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateTaskRequest' }
 *     responses:
 *       200:
 *         description: Task updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       413: { $ref: '#/components/responses/PayloadTooLarge' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
taskRouter.put('/:id', protect, validateRequest(updateTaskSchema), updateTask);

/**
 * @openapi
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete one of the caller's tasks
 *     description: Returns the deleted task.
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     responses:
 *       200:
 *         description: Task deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
taskRouter.delete('/:id', protect, deleteTask);

export default taskRouter;