import { Router } from 'express';
import { loginUser, registerUser } from '../controllers/authController.ts';
import { loginSchema, registerSchema, validateRequest } from '../utils/validators.ts';

const authRouter = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Creates an account. Shares the auth rate limit with login.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterRequest' }
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/RegisterResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       413: { $ref: '#/components/responses/PayloadTooLarge' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
authRouter.post('/register', validateRequest(registerSchema), registerUser);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     description: Returns the same generic INVALID_CREDENTIALS error for a wrong password or an unknown email. Shares the auth rate limit with register.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: Login successful, returns a JWT
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LoginResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       413: { $ref: '#/components/responses/PayloadTooLarge' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
authRouter.post('/login', validateRequest(loginSchema), loginUser);

export default authRouter;