import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.ts';
import { Task } from '../models/Task.ts';
import { User } from '../models/User.ts';
import { assertSeedAllowed } from './seedGuard.ts';

export const demoUser = {
  name: 'Demo User',
  email: 'demo@taskflow.example',
  password: 'DemoUserPass!123',
};

const demoTasks = [
  {
    title: 'Draft Q3 report',
    description: 'Pull numbers from the last quarter and summarize key trends',
    status: 'in-progress' as const,
  },
  {
    title: 'Review pull requests',
    description: 'Go through open PRs from the team and leave feedback',
    status: 'pending' as const,
  },
  {
    title: 'Plan sprint retro',
    description: 'Put together discussion points for Friday\'s retro',
    status: 'pending' as const,
  },
  {
    title: 'Fix login page styling',
    description: 'Address the spacing issue reported on mobile',
    status: 'completed' as const,
  },
];


export async function runSeed(env: Record<string, string | undefined> = process.env) {
  assertSeedAllowed(env);

  await connectDB();

  const existingUser = await User.findOne({ email: demoUser.email });

  if (existingUser) {
    await Task.deleteMany({ userId: existingUser._id });
    await existingUser.deleteOne();
    console.log('Removed existing demo user and their tasks.');
  }

  const createdUser = await User.create(demoUser);

  const createdTasks = await Task.insertMany(
    demoTasks.map((task) => ({ ...task, userId: createdUser._id }))
  );

  return { email: createdUser.email, taskCount: createdTasks.length };
}

async function main() {
  try {
    const { email, taskCount } = await runSeed();
    console.log(`Seed complete: demo user "${email}" created with ${taskCount} tasks.`);
  } catch (error) {
    console.error('Seeding failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await main();
}