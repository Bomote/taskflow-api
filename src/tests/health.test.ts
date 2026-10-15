import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.ts';
import { connectDB } from '../config/db.ts';

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// ==========================================
// 1. LIVENESS: "is the process running?" (never touches the database)
// ==========================================

describe('GET /health/live', () => {
  test('returns 200 with status ok', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  test('stays 200 while the database is disconnected', async () => {
    expect(mongoose.connection.readyState).toBe(0);

    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
  });
});

// ==========================================
// 2. READINESS: "can it serve traffic?" (reflects the database connection)
// ==========================================

describe('GET /health/ready', () => {
  test('returns 503 unavailable when the database was never connected', async () => {
    expect(mongoose.connection.readyState).toBe(0);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  test('returns 503 while a connection attempt is still in progress', async () => {
    const attempt = mongoose
      .connect('mongodb://127.0.0.1:1/unreachable', { serverSelectionTimeoutMS: 500 })
      .catch(() => undefined);

    expect(mongoose.connection.readyState).toBe(2);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });

    await attempt;
  });

  test('follows a real connection: 200 while connected, 503 after disconnecting', async () => {
    await connectDB();

    const whileConnected = await request(app).get('/health/ready');
    expect(whileConnected.status).toBe(200);
    expect(whileConnected.body).toEqual({ status: 'ok' });

    await mongoose.disconnect();

    const afterDisconnect = await request(app).get('/health/ready');
    expect(afterDisconnect.status).toBe(503);
    expect(afterDisconnect.body).toEqual({ status: 'unavailable' });
  });
});