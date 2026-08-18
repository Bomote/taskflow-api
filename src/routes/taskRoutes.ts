import express from "express";
import { createTask, deleteTask, getTaskById, getTasks, updateTask } from "../controllers/taskController.ts";

const router = express.Router();

// GET routes
router.get('/', getTasks)
router.get('/:id', getTaskById)

//Post route
router.post('/', createTask)

// Put route
router.put('/:id', updateTask)

//Delete route
router.delete('/:id', deleteTask)

export default router