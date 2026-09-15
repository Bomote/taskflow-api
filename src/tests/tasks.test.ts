import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.ts';
import { connectDB } from '../config/db.ts';

let token: string;

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

test('rejects PUT /api/tasks/:id with an empty body', async () => {
  const allTasks = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`);
  const taskId = allTasks.body.data[0]._id;

  const response = await request(app)
    .put(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('EMPTY_UPDATE');
});

test('rejects a limit above the allowed maximum', async () => {
  const response = await request(app)
  .get('/api/tasks')
  .set('Authorization', `Bearer ${token}`)
  .query({page: '1', limit: '20'})

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
})