import request from 'supertest';
import app from '../app.ts';
import { AUTH_RATE_LIMITS } from '../config/rateLimits.ts';

type Captured = { status: number; body: any; headers: Record<string, string> };

describe('auth rate limiting', () => {
  let overLimit: Captured;

  beforeAll(async () => {
    for (let attempt = 1; attempt <= AUTH_RATE_LIMITS.limit; attempt += 1) {
      const response = await request(app).post('/api/auth/login').send({});

      if (response.status !== 400) {
        throw new Error(`Request ${attempt} returned ${response.status}; expected 400 within the limit.`);
      }
    }

    overLimit = await request(app).post('/api/auth/login').send({});
  });

  test('the first request over the limit returns 429 in the standard error shape', () => {
    expect(overLimit.status).toBe(429);
    expect(overLimit.headers['content-type']).toMatch(/application\/json/);
    expect(overLimit.body).toEqual({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
    });
  });

  test('tells the client when to retry and still carries a request ID', () => {
    expect(Number(overLimit.headers['retry-after'])).toBeGreaterThan(0);
    expect(overLimit.headers['x-request-id']).toBeDefined();
  });

  test('the allowance is shared between login and register', async () => {
    const response = await request(app).post('/api/auth/register').send({});

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  test('does not limit routes outside /api/auth', async () => {
    const health = await request(app).get('/health/live');
    const tasks = await request(app).get('/api/tasks');

    expect(health.status).toBe(200);
    expect(tasks.status).toBe(401);
  });
});