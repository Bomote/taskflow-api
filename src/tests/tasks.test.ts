import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.ts';
import { connectDB } from '../config/db.ts';

let token: string;
let otherUserToken: string;

const validUser = {
  name: 'Jane Task-Tester',
  email: 'jane.tasks@example.com',
  password: 'TestDataPass!123',
};

const validTask = {
  title: 'New Task',
  description: 'creating a new task',
  status: 'pending',
};

beforeAll(async () => {
  await connectDB();

  await request(app).post('/api/auth/register').send(validUser);

  const response = await request(app).post('/api/auth/login').send({
    email: validUser.email,
    password: validUser.password,
  });

  token = response.body.data.token;

  await request(app).post('/api/auth/register').send({
    name: 'Other User',
    email: 'other.tasks@example.com',
    password: 'TestDataPass!123',
  });

  const otherLogin = await request(app).post('/api/auth/login').send({
    email: 'other.tasks@example.com',
    password: 'TestDataPass!123',
  });

  otherUserToken = otherLogin.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
});

test('creates a task with a valid token', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(validTask);

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data.title).toBe(validTask.title);
});

test('fetches tasks with a valid token', async () => {
  const response = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(Array.isArray(response.body.data)).toBe(true);
});

test('rejects GET /api/tasks with no auth header', async () => {
  const response = await request(app).get('/api/tasks');

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});

test('rejects POST /api/tasks with no auth header', async () => {
  const response = await request(app).post('/api/tasks').send(validTask);

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});

test('rejects POST /api/tasks with a malformed token', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', 'Bearer wrong-token')
    .send(validTask);

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});

test('rejects requests with an expired token', async () => {
  const expiredToken = jwt.sign(
    { id: '000000000000000000000001', exp: Math.floor(Date.now() / 1000) - 10 },
    'test-jwt-secret'
  );

  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${expiredToken}`);

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});

test('updates a task with a valid token', async () => {
  const created = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(validTask);

  const response = await request(app)
    .put(`/api/tasks/${created.body.data._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Updated Title' });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data.title).toBe('Updated Title');
});

test('rejects an update with an empty body', async () => {
  const created = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(validTask);

  const response = await request(app)
    .put(`/api/tasks/${created.body.data._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test('deletes a task and returns 404 when fetching it afterwards', async () => {
  const created = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(validTask);

  const taskId = created.body.data._id as string;

  const deleted = await request(app)
    .delete(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(deleted.status).toBe(200);
  expect(deleted.body.success).toBe(true);

  const fetched = await request(app)
    .get(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(fetched.status).toBe(404);
  expect(fetched.body.success).toBe(false);
});

test('rejects task creation when the title is too short', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'ab' });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test('rejects task creation with an invalid status', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Valid title', status: 'archived' });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test('rejects fetching a task with a malformed id', async () => {
  const response = await request(app)
    .get('/api/tasks/not-a-valid-id')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test("hides one user's tasks from another user", async () => {
  const created = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(validTask);

  const taskId = created.body.data._id as string;

  for (const [method, path] of [
    ['get', `/api/tasks/${taskId}`],
    ['put', `/api/tasks/${taskId}`],
    ['delete', `/api/tasks/${taskId}`],
  ] as const) {
    const response =
      method === 'put'
        ? await request(app)
            [method](path)
            .set('Authorization', `Bearer ${otherUserToken}`)
            .send({ title: 'Hijacked' })
        : await request(app)[method](path).set('Authorization', `Bearer ${otherUserToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  }

  const untouched = await request(app)
    .get(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(untouched.status).toBe(200);
  expect(untouched.body.data.title).toBe(validTask.title);
});

test('paginates the task list', async () => {
  for (let i = 0; i < 3; i++) {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validTask, title: `Paginated task ${i}` });
  }

  const firstPage = await request(app)
    .get('/api/tasks?limit=2&page=1')
    .set('Authorization', `Bearer ${token}`);

  expect(firstPage.status).toBe(200);
  expect(firstPage.body.data).toHaveLength(2);
  expect(firstPage.body.pagination.total).toBeGreaterThanOrEqual(3);
  expect(firstPage.body.pagination.totalPages).toBeGreaterThanOrEqual(2);

  const secondPage = await request(app)
    .get('/api/tasks?limit=2&page=2')
    .set('Authorization', `Bearer ${token}`);

  expect(secondPage.status).toBe(200);
  expect(secondPage.body.data.length).toBeGreaterThanOrEqual(1);
});

test('rejects non-positive pagination parameters', async () => {
  const response = await request(app)
    .get('/api/tasks?page=0&limit=-5')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test('returns a JSON 404 for unknown routes', async () => {
  const response = await request(app).get('/api/definitely-not-here');

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
  expect(typeof response.body.error).toBe('string');
});