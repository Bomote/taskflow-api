import express from 'express'
import { connectDB } from './config/db.ts'
import taskRouter from './routes/taskRoutes.ts'

const app = express()
const PORT = process.env.PORT || 5000

async function startServer() {
    try {
        await connectDB()
        console.log("database up and running")
    } catch (error) {
        console.error("database error")
        process.exit(1)
    }
    
    app.use(express.json())
    
    app.get('/health', (req, res) => {
        res.status(200).json({status: "ok", timestamp: new Date()})
    })
    
    app.use('/api/tasks', taskRouter)

    app.listen(PORT, () => {
        console.log(`Listening on port ${PORT}`)
    }).on('error', (err) => {
        console.error(`Error starting server: ${err.message}`)
        process.exit(1)
    })
}

startServer()