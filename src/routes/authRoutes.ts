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
 *                 description: At least 8 characters with one uppercase letter, one lowercase letter, one number and one special character
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email already registered
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
 *       401:
 *         description: Invalid credentials (same message for wrong password or unknown email)
 *       500:
 *         description: Unexpected server error
 */
authRouter.post('/login', validateRequest(loginSchema), loginUser);

export default authRouter;