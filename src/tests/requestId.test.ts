import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../app.ts';
import { User } from '../models/User.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function expectGeneratedRequestId(response: { headers: Record<string, string> }) {
  expect(response.headers['x-request-id']).toMatch(UUID_PATTERN);
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ==========================================
// 1. HEADER IS PRESENT ON EVERY KIND OF RESPONSE
// ==========================================

test('returns 200 and a request ID for liveness', async () => {
  const response = await request(app).get('/health/live');

  expect(response.status).toBe(200);
  expectGeneratedRequestId(response);
});

test('returns 401 and a request ID when the token is missing', async () => {
  const response = await request(app).get('/api/tasks');

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe('UNAUTHORIZED');
  expectGeneratedRequestId(response);
});

test('returns 404 and a request ID for an unknown path', async () => {
  const response = await request(app).get('/unknown/path');

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  expectGeneratedRequestId(response);
});

test('returns 400 and a request ID for a validation failure', async () => {
  const response = await request(app).post('/api/auth/register').send({});

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expectGeneratedRequestId(response);
});

test('returns 413 and a request ID when the body exceeds the limit', async () => {
  // Must be sent as JSON: a plain string is labelled form-urlencoded by supertest
  // and would skip express.json() entirely.
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'big@example.com', password: 'a'.repeat(1024 * 1024) });

  expect(response.status).toBe(413);
  expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  expectGeneratedRequestId(response);
});

test('returns 400 INVALID_JSON and a request ID for malformed JSON', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{bad json}');

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('INVALID_JSON');
  expectGeneratedRequestId(response);
});

// ==========================================
// 2. CLIENT-SUPPLIED IDS: ACCEPT SAFE ONES, REPLACE THE REST
// ==========================================

test('echoes a safe client-supplied request ID unchanged', async () => {
  const response = await request(app)
    .get('/health/live')
    .set('X-Request-Id', 'my-trace-123');

  expect(response.headers['x-request-id']).toBe('my-trace-123');
});

test.each([
  ['longer than 64 characters', 'A'.repeat(65)],
  ['containing a space', 'has a space'],
  ['containing disallowed characters', 'bad/id;drop'],
])('replaces a client-supplied request ID %s', async (_label, badId) => {
  const response = await request(app)
    .get('/health/live')
    .set('X-Request-Id', badId);

  expect(response.headers['x-request-id']).not.toBe(badId);
  expectGeneratedRequestId(response);
});

// ==========================================
// 3. UNEXPECTED FAILURES: CORRELATED, LOGGED, NEVER LEAKED
// ==========================================

test('a 500 body carries the same request ID as the header and the log, and leaks nothing', async () => {
  const secretDetail = 'Simulated failure: connection string exposed in this message';

  const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
    throw new Error(secretDetail);
  });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'failing@example.com', password: 'SomePassword123!' });

  const headerId = response.headers['x-request-id'];

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe('INTERNAL_ERROR');
  expect(headerId).toMatch(UUID_PATTERN);
  expect(response.body.requestId).toBe(headerId);

  // Nothing sensitive reaches the client...
  expect(JSON.stringify(response.body)).not.toContain(secretDetail);
  expect(JSON.stringify(response.body)).not.toContain('stack');

  // ...but the server log has the same ID, so the failure can be found.
  expect(logSpy).toHaveBeenCalledWith(`[${headerId}]`, expect.any(Error));
});