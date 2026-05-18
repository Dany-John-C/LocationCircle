import { Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import jwt from 'jsonwebtoken'
import { query } from '../db'
import { setLocation, publishLocation } from './redisService'
import { reverseGeocode } from './mapsService'

export let io: SocketServer

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // ── Auth middleware ─────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Authentication required'))
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string; email: string
      }
      socket.data.userId = payload.id
      socket.data.email = payload.email
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId: string = socket.data.userId
    console.log(`[Socket] User ${userId} connected (${socket.id})`)

    // ── Join group room ───────────────────────────────────────
    socket.on('room:join', async ({ groupId }: { groupId: string }) => {
      // Verify membership before joining room
      const result = await query(
        `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
        [userId, groupId],
      )
      if (!result.rows.length) {
        socket.emit('error', 'Not a member of this group')
        return
      }
      socket.join(groupId)
      socket.data.groupId = groupId
      console.log(`[Socket] User ${userId} joined room ${groupId}`)
    })

    // ── Leave group room ─────────────────────────────────────
    socket.on('room:leave', ({ groupId }: { groupId: string }) => {
      socket.leave(groupId)
    })

    // ── Location update from client ──────────────────────────
    socket.on('location:update', async (data: {
      lat: number
      lng: number
      groupId: string
    }) => {
      const { lat, lng, groupId } = data

      // Check if user has sharing enabled
      const userResult = await query(
        'SELECT sharing FROM users WHERE id = $1',
        [userId],
      )
      if (!userResult.rows[0]?.sharing) return

      const now = new Date().toISOString()

      // Reverse geocode in background
      reverseGeocode(lat, lng).then(async (geo) => {
        const locData = {
          userId,
          groupId,
          lat,
          lng,
          locality: geo?.locality,
          updatedAt: now,
        }

        // Write to Redis
        await setLocation(locData)

        // Persist to PostgreSQL
        await query(
          `INSERT INTO locations (user_id, group_id, lat, lng, locality, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id, group_id)
           DO UPDATE SET lat = $3, lng = $4, locality = $5, updated_at = NOW()`,
          [userId, groupId, lat, lng, geo?.locality],
        )

        // Broadcast to all group members
        io.to(groupId).emit('location:broadcast', locData)
      })
    })

    // ── Sharing toggled ──────────────────────────────────────
    socket.on('sharing:toggle', async ({ sharing }: { sharing: boolean }) => {
      const groupId = socket.data.groupId
      await query('UPDATE users SET sharing = $1 WHERE id = $2', [sharing, userId])
      if (groupId) {
        io.to(groupId).emit('member:sharing-changed', { userId, sharing })
      }
    })

    // ── Disconnect ───────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${userId} disconnected: ${reason}`)
    })
  })

  return io
}
