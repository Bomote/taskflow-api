import mongoose from 'mongoose';
import request from 'supertest';
import { connectDB } from '../config/db.ts';
import app from '../app.ts';

const validUser = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'TestDataPass!123',
};

const missingNameUser = {
  email: 'jane@example.com',
  password: 'TestDataPass!123',
};

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
});

test('registers a new user successfully', async () => {
  const response = await request(app).post('/api/auth/register').send(validUser);

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
});

test('rejects registration when a required field is missing', async () => {
  const response = await request(app).post('/api/auth/register').send(missingNameUser);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test('rejects registration when the email is already taken', async () => {
  const response = await request(app).post('/api/auth/register').send(validUser);

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toMatch(/already registered/i);
});

test('logs in successfully with valid credentials', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: validUser.email,
    password: validUser.password,
  });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(typeof response.body.data.token).toBe('string');
});

test('rejects login with an incorrect password', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: validUser.email,
    password: 'WrongPassword!123',
  });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});

test('rejects login for a nonexistent email, with the same message as a wrong password', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: 'doesnotexist@example.com',
    password: 'WrongPassword!123',
  });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toBe('Invalid credentials');
});