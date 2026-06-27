import Redis from 'ioredis'
import '../config/env'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
})

redis.on('connect', () => console.log('✅ Redis connected'))
redis.on('error', (err) => console.error('❌ Redis error:', err))

const LOCATION_TTL = 300 // 5 minutes

export interface LocationData {
  userId: string
  groupId: string
  lat: number
  lng: number
  locality?: string
  accuracy?: number
  updatedAt: string
}

export async function setLocation(data: LocationData): Promise<void> {
  const key = `loc:${data.userId}:${data.groupId}`
  await redis.setex(key, LOCATION_TTL, JSON.stringify(data))
}

export async function getLocation(
  userId: string,
  groupId: string,
): Promise<LocationData | null> {
  const raw = await redis.get(`loc:${userId}:${groupId}`)
  return raw ? JSON.parse(raw) : null
}

export async function getGroupLocations(
  groupId: string,
  userIds: string[],
): Promise<LocationData[]> {
  if (!userIds.length) return []
  const keys = userIds.map((id) => `loc:${id}:${groupId}`)
  const values = await redis.mget(...keys)
  return values
    .filter(Boolean)
    .map((v) => JSON.parse(v!))
}

export async function deleteLocation(userId: string, groupId: string): Promise<void> {
  await redis.del(`loc:${userId}:${groupId}`)
}

export async function publishLocation(
  groupId: string,
  data: LocationData,
): Promise<void> {
  await redis.publish(`group:${groupId}`, JSON.stringify(data))
}

// Session management
export async function setSession(userId: string, token: string): Promise<void> {
  await redis.setex(`session:${userId}`, 60 * 60 * 24 * 30, token) // 30 days
}

export async function deleteSession(userId: string): Promise<void> {
  await redis.del(`session:${userId}`)
}

export default redis
