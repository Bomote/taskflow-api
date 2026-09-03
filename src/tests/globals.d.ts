import type { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  var __MONGO_INSTANCE__: MongoMemoryServer;
  var __MONGO_URI__: string;
}

export {};