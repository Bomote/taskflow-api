import { ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI || '';

if (!URI.trim()) {
  throw new Error('MONGODB_URI is not defined in the environment variables');
}

const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

// Mongoose connection.readyState values:
// 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
const READY_STATE = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  CONNECTING: 2,
  DISCONNECTING: 3,
} as const;

let connectingPromise: Promise<typeof mongoose.connection> | null = null;

export async function connectDB() {
  // Already connected — return the existing connection, don't reconnect.
  if (mongoose.connection.readyState === READY_STATE.CONNECTED) {
    return mongoose.connection;
  }

  // A connection attempt is already in flight (e.g. two near-simultaneous
  // callers during startup) — return that same in-progress promise instead
  // of racing a second mongoose.connect() call against it.
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    await mongoose.connect(URI, clientOptions);

    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }
    await mongoose.connection.db.admin().command({ ping: 1 });

    console.log('Pinged your deployment. You successfully connected to MongoDB!');

    // Listen once for post-connect errors (e.g. Atlas network blip after
    // a successful boot). Attached only on first successful connect.
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error after initial connect:', err);
    });

    return mongoose.connection;
  })();

  try {
    return await connectingPromise;
  } finally {
    // Clear the in-flight marker whether it succeeded or failed, so a
    // failed attempt can be retried by a later call instead of being
    // stuck returning a rejected promise forever.
    connectingPromise = null;
  }
}