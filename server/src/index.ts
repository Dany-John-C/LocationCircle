import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { initSocket } from './services/socketService'
import { startCronJobs } from './services/cronService'

import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import groupRoutes from './routes/groups'
import locationRoutes from './routes/locations'
import webhookRoutes from './routes/webhook'

const app = express()
const httpServer = createServer(app)

// ── Security middleware ───────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 200 }))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/users',     userRoutes)
app.use('/api/groups',    groupRoutes)
app.use('/api/locations', locationRoutes)
app.use('/api/webhook',   webhookRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Initialize Socket.io ──────────────────────────────────────
initSocket(httpServer)

// ── Start cron jobs ───────────────────────────────────────────
startCronJobs()

// ── Start server ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10)
httpServer.listen(PORT, () => {
  console.log(`\n🚀 LocationCircle Server running on http://localhost:${PORT}`)
  console.log(`📡 Socket.io ready`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`)
})

export { app, httpServer }
