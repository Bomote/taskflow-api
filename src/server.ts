import { connectDB } from './config/db.ts';
import app from './app.ts';

const PORT = process.env.PORT ?? 5000;

async function startServer() {
  try {
    await connectDB();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

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