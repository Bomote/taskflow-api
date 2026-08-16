import { connectDB } from '../config/db.ts';
import mongoose from 'mongoose';
import { Task } from '../models/Task.ts';

async function runTest() {
  console.log('Starting schema test');
  await connectDB();

  try {
    console.log('Testing valid data...');
    const validTask = await Task.create({
      title: 'test task',
      description: 'testing the task schema',
      status: 'pending',
    });
    console.log('✓ Valid task created:', validTask.toObject());

    console.log('Testing invalid data (bad status)...');
    try {
        //intentionally passing an invalid status to test validation - ignore the TypeScript error for this test case
        // @ts-ignore
      await Task.create({ title: 'bad task', status: 'not-a-real-status' });
      console.error('✗ Expected validation to fail, but it succeeded');
    } catch (validationError) {
      console.log('✓ Validation correctly rejected bad status');
    }

    console.log('Cleaning up test documents...');
    await Task.deleteMany({ title: { $in: ['test task', 'bad task'] } });
  } catch (error) {
    console.error('Unexpected error during test:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();