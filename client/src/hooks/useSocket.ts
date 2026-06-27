import { useCallback, useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import { useGroupStore } from '../store/groupStore'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Singleton socket exported for use in location hook
export let socket: Socket

export function useSocket(groupId: string | undefined) {
  const { token } = useAuthStore()
  const { updateLocation } = useLocationStore()
  const { updateMember } = useGroupStore()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token || !groupId) return

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket = s
    socketRef.current = s

    s.on('connect', () => {
      console.log('[Socket] Connected:', s.id)
      s.emit('room:join', { groupId })
    })

    s.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason)
    })

    // Real-time location update from another member
    s.on('location:broadcast', (data: {
      userId: string
      lat: number
      lng: number
      locality?: string
      accuracy?: number
      updatedAt: string
    }) => {
      updateLocation(data.userId, data)
    })

    // Head changed — update member role in store
    s.on('head:changed', ({ oldHeadId, newHeadId }: {
      oldHeadId: string
      newHeadId: string
    }) => {
      updateMember(oldHeadId, { role: 'member' })
      updateMember(newHeadId, { role: 'head' })
    })

    // Member paused/resumed sharing
    s.on('member:sharing-changed', ({ userId, sharing }: {
      userId: string
      sharing: boolean
    }) => {
      updateMember(userId, { sharing })
    })

    return () => {
      s.emit('room:leave', { groupId })
      s.disconnect()
    }
  }, [token, groupId])

  const emitLocation = useCallback((lat: number, lng: number) => {
    if (socketRef.current?.connected && groupId) {
      socketRef.current.emit('location:update', { lat, lng, groupId })
    }
  }, [groupId])

  return { emitLocation }
}
