import express from 'express';
import { connectDB } from './config/db.ts';
import taskRouter from './routes/taskRoutes.ts';

const app = express();
const PORT = process.env.PORT ?? 5000;

async function startServer() {
  try {
    await connectDB();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  app.use('/api/tasks', taskRouter);

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