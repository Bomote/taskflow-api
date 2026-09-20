import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.ts';
import { connectDB } from '../config/db.ts';
import { User } from '../models/User.ts';
import { Task } from '../models/Task.ts';

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

test('pagination correctly slices results across pages', async () => {
  const before = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
  const initialTotal = before.body.pagination.total;

  const limit = 5;
  const tasksToCreate = limit + 3;

  const testUser = await User.findOne({ email: validUser.email });
  if (!testUser) {
    throw new Error('Test setup failed: could not find seeded test user');
  }

  const seedTasks = Array.from({ length: tasksToCreate }, (_, i) => ({
    title: `Pagination seed task ${i}`,
    description: 'seeded for pagination test',
    status: 'pending',
    userId: testUser._id,
  }));

  await Task.insertMany(seedTasks);

  const page1 = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .query({ page: 1, limit });

  const page2 = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .query({ page: 2, limit });

  const expectedTotal = initialTotal + tasksToCreate;
  const expectedPage2Size = expectedTotal - limit;

  expect(page1.status).toBe(200);
  expect(page1.body.data.length).toBe(limit);
  expect(page1.body.pagination).toEqual({
    page: 1,
    limit,
    total: expectedTotal,
    totalPages: Math.ceil(expectedTotal / limit),
  });

  expect(page2.status).toBe(200);
  expect(page2.body.data.length).toBe(expectedPage2Size);
  expect(page2.body.pagination.page).toBe(2);

  const page1Ids = page1.body.data.map((task: { _id: string }) => task._id);
  const page2Ids = page2.body.data.map((task: { _id: string }) => task._id);
  const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));

  expect(overlap).toHaveLength(0);
});

test('accepts the maximum allowed limit', async () => {
  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .query({ page: 1, limit: 15 });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.pagination.limit).toBe(15);
});