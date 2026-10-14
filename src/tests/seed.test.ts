import mongoose from 'mongoose';
import { runSeed, demoUser } from '../utils/seed.ts';
import { User } from '../models/User.ts';
import { Task } from '../models/Task.ts';


const allowedEnv = { ...process.env, CONFIRM_SEED: 'true' };

const bystander = {
  name: 'Seed Bystander',
  email: 'seed.bystander@example.com',
  password: 'TestDataPass!123',
};

afterAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const demo = await User.findOne({ email: demoUser.email });
  if (demo) {
    await Task.deleteMany({ userId: demo._id });
    await demo.deleteOne();
  }
  const other = await User.findOne({ email: bystander.email });
  if (other) {
    await Task.deleteMany({ userId: other._id });
    await other.deleteOne();
  }

  await mongoose.disconnect();
});

test('a refused run never opens a database connection', async () => {
  await expect(runSeed({ ...process.env, CONFIRM_SEED: 'false' })).rejects.toThrow(/CONFIRM_SEED/);

  expect(mongoose.connection.readyState).toBe(0);
});

test('creates the demo user with four tasks', async () => {
  const result = await runSeed(allowedEnv);

  expect(result).toEqual({ email: demoUser.email, taskCount: 4 });

  const user = await User.findOne({ email: demoUser.email });
  expect(user).not.toBeNull();
  expect(await Task.countDocuments({ userId: user!._id })).toBe(4);
});

test('running twice gives the same result and does not duplicate data', async () => {
  await runSeed(allowedEnv);
  await runSeed(allowedEnv);

  expect(await User.countDocuments({ email: demoUser.email })).toBe(1);

  const user = await User.findOne({ email: demoUser.email });
  expect(await Task.countDocuments({ userId: user!._id })).toBe(4);
});

test('leaves other users and their tasks untouched', async () => {
  const other = await User.create(bystander);
  await Task.create({
    title: 'Bystander task',
    description: 'must survive the seed',
    status: 'pending',
    userId: other._id,
  });

  await runSeed(allowedEnv);

  expect(await User.countDocuments({ email: bystander.email })).toBe(1);
  expect(await Task.countDocuments({ userId: other._id })).toBe(1);
});