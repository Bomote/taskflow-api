import mongoose from "mongoose";
const { Schema } = mongoose;

const taskSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: ["pending", "in-progress", "completed"],
        default: "pending"
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref:'User'
    }
})

export const Task = mongoose.model('Task', taskSchema)