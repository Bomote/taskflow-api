import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.ts';
import { connectDB } from '../config/db.ts';
import { User } from '../models/User.ts';
import { Task } from '../models/Task.ts';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

let token: string;
let taskId: string;
let newToken: string;
let newTaskId: string;

const validUser = {
  name: 'Jane Task-Tester',
  email: 'jane.tasks@example.com',
  password: 'TestDataPass!123',
};

const secondUser = {
  name: 'John Task-Tester',
  email: 'john.tasks@example.com',
  password: 'TestDataPass!123',
};

const validTask = {
  title: 'New Task',
  description: 'creating a new task',
  status: 'pending',
};

const secondTask = {
  title: 'New Task 2',
  description: 'creating another task',
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

  await request(app).post('/api/auth/register').send(secondUser);
  const secondResponse = await request(app).post('/api/auth/login').send({
    email: secondUser.email,
    password: secondUser.password,
  });
  newToken = secondResponse.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
});

// ==========================================
// 1. CORE CRUD HAPPY PATHS
// ==========================================

test('creates a task with a valid token', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(validTask);

  taskId = response.body.data._id;

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

test('fetches a single owned task', async () => {
  const response = await request(app)
    .get(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data._id).toBe(taskId);
  expect(response.body.data.title).toBe(validTask.title);
});

test('updates an owned task and persists the change', async () => {
  const updateResponse = await request(app)
    .put(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'completed' });

  expect(updateResponse.status).toBe(200);
  expect(updateResponse.body.success).toBe(true);
  expect(updateResponse.body.data.status).toBe('completed');

  const followUp = await request(app)
    .get(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(followUp.body.data.status).toBe('completed');
});

test('deletes an owned task', async () => {
  const deleteResponse = await request(app)
    .delete(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(deleteResponse.status).toBe(200);
  expect(deleteResponse.body.success).toBe(true);

  const followUp = await request(app)
    .get(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(followUp.status).toBe(404);
});

// ==========================================
// 2. AUTH EDGE CASES (Tokens, Headers, Expiry)
// ==========================================

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

test('rejects an expired token', async () => {
  const expiredToken = jwt.sign({ id: 'someuserid' }, process.env.JWT_SECRET!, {
    algorithm: 'HS256',
    expiresIn: '-1s',
  });

  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${expiredToken}`);

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('UNAUTHORIZED');
});

// ==========================================
// 3. VALIDATION EDGE CASES
// ==========================================

test('rejects a malformed task ID', async () => {
  const response = await request(app)
    .get('/api/tasks/not-a-real-id')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('INVALID_ID');
});

test('rejects PUT /api/tasks/:id with an empty body', async () => {
  const response = await request(app)
    .put(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('EMPTY_UPDATE');
});

test('rejects an invalid status value on update, with no saved change', async () => {
  const setup = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Invalid status test target', status: 'pending' });
  const targetId = setup.body.data._id;

  const response = await request(app)
    .put(`/api/tasks/${targetId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'ongoing' });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');

  const followUp = await request(app)
    .get(`/api/tasks/${targetId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(followUp.body.data.status).toBe('pending');
});

test('creates a task with a valid token, but ignores unknown fields', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Valid title field',
      description: 'Valid description field',
      status: 'pending',
      foo: 'bar',
      isAdmin: true,
    });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data).not.toHaveProperty('foo');
  expect(response.body.data).not.toHaveProperty('isAdmin');
});

test('rejects an empty string title', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '', status: 'pending' });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
});

test('rejects a task description over the maximum length', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Oversized description test',
      description: 'x'.repeat(5001),
      status: 'pending',
    });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
});

// ==========================================
// 4. MASS-ASSIGNMENT & OWNERSHIP INTEGRITY
// ==========================================

test('ignores a client-supplied userId and _id when creating a task', async () => {
  const maliciousUserId = new mongoose.Types.ObjectId().toString();
  const maliciousId = new mongoose.Types.ObjectId().toString();

  const realOwner = await User.findOne({ email: validUser.email });
  if (!realOwner) {
    throw new Error('Test setup failed: could not find seeded test user');
  }

  const setup = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({
      userId: maliciousUserId,
      _id: maliciousId,
      title: 'Mass assignment target for create task',
      status: 'pending',
    });

  const targetId = setup.body.data._id;

  expect(setup.status).toBe(201);
  expect(setup.body.success).toBe(true);
  expect(targetId).not.toBe(maliciousId);

  const response = await request(app)
    .get(`/api/tasks/${targetId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data._id).toBe(targetId);
  expect(response.body.data.userId).toBe(realOwner._id.toString());
  expect(response.body.data.title).toBe('Mass assignment target for create task');

  const secondUserResponse = await request(app)
    .get(`/api/tasks/${targetId}`)
    .set('Authorization', `Bearer ${newToken}`);

  expect(secondUserResponse.status).toBe(404);
  expect(secondUserResponse.body.success).toBe(false);
});

test('ignores a client-supplied userId and _id when editing a task', async () => {
  const maliciousUserId = new mongoose.Types.ObjectId().toString();
  const maliciousId = new mongoose.Types.ObjectId().toString();

  const realOwner = await User.findOne({ email: validUser.email });
  if (!realOwner) {
    throw new Error('Test setup failed: could not find seeded test user');
  }

  const setup = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({
      userId: maliciousUserId,
      _id: maliciousId,
      title: 'Mass assignment target for edit task',
      status: 'pending',
    });

  const targetId = setup.body.data._id;

  const changeResponse = await request(app)
    .put(`/api/tasks/${targetId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ 
      title: 'Second legitimately changed title',
      userId: maliciousUserId,
      _id: maliciousId 
    });

  expect(changeResponse.status).toBe(200);
  expect(changeResponse.body.data.title).toBe('Second legitimately changed title');

  const response = await request(app)
    .get(`/api/tasks/${targetId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.data._id).toBe(targetId);
  expect(response.body.data.userId).toBe(realOwner._id.toString());
  expect(response.body.data.title).toBe('Second legitimately changed title');

  const secondUserResponse = await request(app)
    .get(`/api/tasks/${targetId}`)
    .set('Authorization', `Bearer ${newToken}`);

  expect(secondUserResponse.status).toBe(404);

  const phantomTaskCheck = await request(app)
    .get(`/api/tasks/${maliciousId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(phantomTaskCheck.status).toBe(404);
});

// ==========================================
// 5. CROSS-USER OWNERSHIP (Ownership 404s)
// ==========================================

test('creates a second task to use as the ownership target', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send(secondTask);

  newTaskId = response.body.data._id;

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data.title).toBe(secondTask.title);
});

test('rejects fetching another user\'s task', async () => {
  const response = await request(app)
    .get(`/api/tasks/${newTaskId}`)
    .set('Authorization', `Bearer ${newToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
});

test('rejects updating another user\'s task', async () => {
  const response = await request(app)
    .put(`/api/tasks/${newTaskId}`)
    .set('Authorization', `Bearer ${newToken}`)
    .send({ title: 'New Title' });

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
});

test('rejects deleting another user\'s task', async () => {
  const response = await request(app)
    .delete(`/api/tasks/${newTaskId}`)
    .set('Authorization', `Bearer ${newToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
});

test('confirms the task was untouched by the blocked update and delete attempts', async () => {
  const response = await request(app)
    .get(`/api/tasks/${newTaskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data.title).toBe(secondTask.title);
});

// ==========================================
// 6. PAGINATION
// ==========================================

test('rejects a limit above the allowed maximum', async () => {
  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .query({ page: '1', limit: '20' });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
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

test('uses documented defaults when page/limit are omitted', async () => {
  const response = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(response.body.pagination.page).toBe(1);
  expect(response.body.pagination.limit).toBe(10);
});

test.each([
  ['zero page', { page: 0 }],
  ['negative page', { page: -1 }],
  ['decimal limit', { limit: 2.5 }],
  ['non-numeric text', { limit: 'abc' }],
  ['unsafe integer', { limit: '99999999999999999999' }],
])('rejects invalid pagination input: %s', async (_label, query) => {
  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .query(query);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test('rejects an array value for limit', async () => {
  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .query('limit=5&limit=10');

  expect(response.status).toBe(400);
});

test('returns an empty list with truthful metadata for a page beyond the end', async () => {
  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .query({ page: 999, limit: 10 });

  expect(response.status).toBe(200);
  expect(response.body.data).toEqual([]);
  expect(response.body.pagination.page).toBe(999);
  expect(response.body.pagination.total).toBeGreaterThanOrEqual(0);
  expect(response.body.pagination.totalPages).toBeLessThan(999);
});

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
  const expectedPage2Size = Math.min(limit, Math.max(expectedTotal - limit, 0));

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

test('pagination totals only reflect the authenticated user\'s own tasks', async () => {
  const theirTasks = await request(app).get('/api/tasks').set('Authorization', `Bearer ${newToken}`);
  const myTasks = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);

  const myIds = myTasks.body.data.map((t: { _id: string }) => t._id);
  const theirIds = theirTasks.body.data.map((t: { _id: string }) => t._id);

  expect(myIds.some((id: string) => theirIds.includes(id))).toBe(false);
});

// ==========================================
// 7. FORCED INTERNAL ERROR (Forced 500)
// ==========================================

test('returns a generic error and leaks nothing when the database fails unexpectedly', async () => {
  const secretDetail = 'Simulated failure: connection string exposed in this message';

  const spy = jest
    .spyOn(Task, 'find')
    .mockImplementationOnce(() => {
      throw new Error(secretDetail);
    });

  const response = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(500);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('INTERNAL_ERROR');
  expect(JSON.stringify(response.body)).not.toContain(secretDetail);

  spy.mockRestore();
});