import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  const instance = await MongoMemoryServer.create();
  const uri = instance.getUri();
  
  globalThis.__MONGO_INSTANCE__ = instance;
  globalThis.__MONGO_URI__ = uri;
  
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test-jwt-secret'

  console.log('[globalSetup] in-memory MongoDB started at', uri);
}