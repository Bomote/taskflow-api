import mongoose from 'mongoose';
import request from 'supertest';
import { connectDB } from '../config/db.ts';
import app from '../app.ts';
import { User } from '../models/User.ts';

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

// ==========================================
// 1. REGISTRATION & WEAK PASSWORD VALIDATION
// ==========================================

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

  expect(response.status).toBe(409);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
});

test('rejects registration with a password missing a required character class (Weak Password)', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Weak Password User',
    email: 'weakpass@example.com',
    password: 'alllowercase',
  });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(response.body.error.details[0].field).toBe('password');
});

test('handles simultaneous duplicate-registration race condition safely', async () => {
  const raceUser = {
    name: 'Race User',
    email: 'race.user@example.com',
    password: 'TestDataPass!123',
  };

  const results = await Promise.all([
    request(app).post('/api/auth/register').send(raceUser),
    request(app).post('/api/auth/register').send(raceUser),
  ]);

  const statuses = results.map((r) => r.status);
  
  expect(statuses).toContain(201);
  expect(statuses).toContain(409);

  // Assert database contains exactly one user with this email
  const userCount = await User.countDocuments({ email: raceUser.email });
  expect(userCount).toBe(1);
});

// ==========================================
// 2. LOGIN & CREDENTIAL VALIDATION
// ==========================================

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
  
  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});

test('rejects login for a nonexistent email, with the same message as a wrong password', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: 'doesnotexist@example.com',
    password: 'WrongPassword!123',
  });

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
});