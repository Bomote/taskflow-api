import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.ts';
import taskRouter from './routes/taskRoutes.ts';
import authRouter from './routes/authRoutes.ts';
import { errorHandler } from './middlewares/errorHandler.ts';

const app = express();
const PORT = process.env.PORT ?? 5000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

async function startServer() {
  try {
    await connectDB();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  app.use('/api/tasks', taskRouter);
  app.use('/api/auth', authLimiter, authRouter);
  app.use(errorHandler);

  app
    .listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    })
    .on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}

startServer();