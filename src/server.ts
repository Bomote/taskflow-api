import mongoose from 'mongoose';
import { connectDB } from './config/db.ts';
import app from './app.ts';

const PORT = process.env.PORT ?? 5000;
let httpServer: ReturnType<typeof app.listen>;

// Graceful shutdown handler
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  
  if (httpServer) {
    httpServer.close(async () => {
      try {
        await mongoose.disconnect();
        console.log('Database connection closed.');
        console.log('Shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('Error during database disconnection:', err);
        process.exit(1);
      }
    });

    // Force shutdown if cleanup takes longer than 10 seconds
    setTimeout(() => {
      console.error('Forcing shutdown due to timeout...');
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function startServer() {
  try {
    await connectDB();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  httpServer = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  httpServer.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

startServer();