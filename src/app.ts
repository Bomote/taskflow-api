import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import taskRouter from './routes/taskRoutes.ts';
import authRouter from './routes/authRoutes.ts';
import metaRouter from './routes/metaRoutes.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { swaggerSpec, swaggerUiServe, swaggerUiSetup } from './config/swagger.ts';
import { sendError } from './utils/errorCodes.ts';
import { requestId } from './middlewares/requestId.ts';

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 'TOO_MANY_REQUESTS'),
});

app.set('trust proxy', 1);
app.use(requestId);

app.use(helmet());
app.use(cors({ exposedHeaders: ['X-Request-Id'] }));
app.use(express.json({ limit: '100kb' }));

app.use(metaRouter);
app.get('/api-docs.json', (_req, res) => {
  res.status(200).json(swaggerSpec);
});

app.use('/api/tasks', taskRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api-docs', swaggerUiServe, swaggerUiSetup);
app.use((req, res) => {
  return sendError(res, 'ROUTE_NOT_FOUND');
});
app.use(errorHandler);

export default app;