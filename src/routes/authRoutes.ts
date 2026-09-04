// src/routes/authRoutes.ts
import { Router } from 'express';
import { loginUser, registerUser } from '../controllers/authController.ts';
import { loginSchema, registerSchema, validateRequest } from '../utils/validators.ts';

const authRouter = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Email already registered, or validation/creation failed
 */
authRouter.post('/register', validateRequest(registerSchema), registerUser);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns a JWT
 *       400:
 *         description: Invalid credentials (same message for wrong password or unknown email)
 *       500:
 *         description: Unexpected server error
 */
authRouter.post('/login', validateRequest(loginSchema), loginUser);

export default authRouter;