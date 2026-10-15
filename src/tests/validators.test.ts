import request from 'supertest';
import app from '../app.ts';
import { registerSchema } from '../utils/validators.ts';

const identity = { name: 'Test User', email: 'bytes@example.com' };

function passwordOfBytes(bytes: number): string {
  return 'Aa1!' + 'x'.repeat(bytes - 4);
}

describe('register password length limit', () => {
  test('accepts a password of exactly 72 bytes', () => {
    const result = registerSchema.safeParse({ ...identity, password: passwordOfBytes(72) });

    expect(result.success).toBe(true);
  });

  test('rejects a password of 73 bytes', () => {
    const result = registerSchema.safeParse({ ...identity, password: passwordOfBytes(73) });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['password']);
    expect(result.error?.issues[0]?.message).toBe('Password must be at most 72 bytes');
  });

  test('counts bytes, not characters: 34 characters can already exceed the limit', () => {
    const password = 'Aa1!' + '€'.repeat(30);

    expect(password.length).toBe(34);
    expect(Buffer.byteLength(password)).toBe(94);
    expect(registerSchema.safeParse({ ...identity, password }).success).toBe(false);
  });

  test('accepts multi-byte characters while the total stays within 72 bytes', () => {
    const password = 'Aa1!' + '€'.repeat(22);

    expect(Buffer.byteLength(password)).toBe(70);
    expect(registerSchema.safeParse({ ...identity, password }).success).toBe(true);
  });

  test('POST /api/auth/register answers 400 VALIDATION_ERROR naming the password field', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...identity, password: passwordOfBytes(73) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([
      { field: 'password', message: 'Password must be at most 72 bytes' },
    ]);
  });
});