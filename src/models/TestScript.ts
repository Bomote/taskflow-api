import { Task } from "./Task.ts";
import { connectDB } from "../config/db.ts";
import mongoose from "mongoose";

async function runtest(){
    console.log("starting schema test")

    await connectDB()

    try{
        console.log("testing valid data")
        const validTask = await Task.create({
            title: 'test task',
            description: 'testing the task schema',
            status: 'pending',
            userId: null,
        })
        console.log("successfully saved task with schema", validTask.toObject())
    } catch (error){
        console.error("Validation error", error)
    } finally {
        await mongoose.disconnect()
    }
}

runtest();