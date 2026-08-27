import { Router } from 'express';
import { loginUser, registerUser } from '../controllers/authController.ts';
import { loginSchema, registerSchema, validateRequest } from '../utils/validators.ts';


const authRouter = Router();

authRouter.post('/register', validateRequest(registerSchema), registerUser);
authRouter.post('/login', validateRequest(loginSchema), loginUser);

export default authRouter;