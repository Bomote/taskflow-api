import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import taskRouter from './routes/taskRoutes.ts';
import authRouter from './routes/authRoutes.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { swaggerUiServe, swaggerUiSetup } from './config/swagger.ts';
import { sendError } from './utils/errorCodes.ts';
import mongoose from 'mongoose';
import { requestId } from './middlewares/requestId.ts';

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({limit: '100kb'}));

app.use(requestId);

app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/ready', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({ status: isConnected ? 'ok' : 'unavailable' });
});

app.use('/api/tasks', taskRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api-docs', swaggerUiServe, swaggerUiSetup);
app.use((req, res) => {
  return sendError(res, 'ROUTE_NOT_FOUND');
});
app.use(errorHandler);

export default app;