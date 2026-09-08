import mongoose from 'mongoose';
import { connectDB } from '../config/db.ts';
import { Task } from '../models/Task.ts';
import { User } from '../models/User.ts';

const CONFIRM_SEED = process.env.CONFIRM_SEED;

const demoUser = {
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

async function seedScript() {
  try {
    if (!CONFIRM_SEED) {
      throw new Error(
        'CONFIRM_SEED is not set — refusing to run. Set CONFIRM_SEED=true to confirm.'
      );
    }

    await connectDB();

    const existingUser = await User.findOne({ email: demoUser.email });

    if (existingUser) {
      await Task.deleteMany({ userId: existingUser._id });
      await existingUser.deleteOne();
      console.log('Removed existing demo user and their tasks.');
    }

    const createdUser = await User.create(demoUser);

    const tasksToInsert = demoTasks.map((task) => ({
      ...task,
      userId: createdUser._id,
    }));

    const createdTasks = await Task.insertMany(tasksToInsert);

    console.log(
      `Seed complete: demo user "${createdUser.email}" created with ${createdTasks.length} tasks.`
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error occurred while seeding the database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedScript();