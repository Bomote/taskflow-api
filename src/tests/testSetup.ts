import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  const instance = await MongoMemoryServer.create();
  
  globalThis.__MONGO_INSTANCE__ = instance;
  globalThis.__MONGO_URI__ = instance.getUri();
}