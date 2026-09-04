import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import taskRouter from './routes/taskRoutes.ts';
import authRouter from './routes/authRoutes.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { swaggerUiServe, swaggerUiSetup } from './config/swagger.ts';

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/tasks', taskRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use(errorHandler);
app.use('/api-docs', swaggerUiServe, swaggerUiSetup);

export default app;