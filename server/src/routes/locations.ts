import { Router, Response } from 'express'
import { query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import {
  setLocation,
  getGroupLocations,
  deleteLocation,
} from '../services/redisService'
import { reverseGeocode, getDistanceAndETA } from '../services/mapsService'
import {
  validate,
  updateLocationSchema,
  pauseSharingSchema,
  etaRequestSchema,
} from '../middleware/validate'

const router = Router()
router.use(authMiddleware)

// GET /api/locations/:groupId — get all member locations for a group
router.get('/:groupId', async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params

  // Verify membership
  const memberCheck = await query(
    `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [req.user!.id, groupId],
  )
  if (!memberCheck.rows.length) {
    res.status(403).json({ error: 'Not a member of this group' })
    return
  }

  const members = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [groupId],
  )
  const userIds = members.rows.map((r: { user_id: string }) => r.user_id)
  const locations = await getGroupLocations(groupId, userIds)
  res.json(locations)
})

// POST /api/locations/:groupId/eta — real distance + ETA via Google Distance
// Matrix (FR-LOC-04). Returns { [userId]: { distance, carEta, transitEta } }.
// Empty/partial when the Maps key is unset — the client falls back to its
// straight-line estimate, so the dashboard still works without a key.
router.post('/:groupId/eta', validate(etaRequestSchema), async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params
  const { originLat, originLng } = req.body

  const memberCheck = await query(
    `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [req.user!.id, groupId],
  )
  if (!memberCheck.rows.length) {
    res.status(403).json({ error: 'Not a member of this group' })
    return
  }

  const members = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1 AND user_id <> $2`,
    [groupId, req.user!.id],
  )
  const userIds = members.rows.map((r: { user_id: string }) => r.user_id)
  const locations = await getGroupLocations(groupId, userIds)

  const entries = await Promise.all(
    locations.map(async (loc) => {
      const eta = await getDistanceAndETA(originLat, originLng, loc.lat, loc.lng)
      return eta ? ([loc.userId, eta] as const) : null
    }),
  )

  const result: Record<string, { distance: string; carEta: string; transitEta: string }> = {}
  for (const entry of entries) {
    if (entry) result[entry[0]] = entry[1]
  }
  res.json(result)
})

// PUT /api/locations/me — update own location (also done via socket, this is REST fallback)
router.put('/me', validate(updateLocationSchema), async (req: AuthRequest, res: Response) => {
  const { lat, lng, groupId } = req.body
  if (lat == null || lng == null || !groupId) {
    res.status(400).json({ error: 'lat, lng, groupId required' })
    return
  }

  const memberCheck = await query(
    `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [req.user!.id, groupId],
  )
  if (!memberCheck.rows.length) {
    res.status(403).json({ error: 'Not a member of this group' })
    return
  }

  const user = await query('SELECT sharing FROM users WHERE id = $1', [req.user!.id])
  if (!user.rows[0]?.sharing) {
    res.status(403).json({ error: 'Location sharing is paused' })
    return
  }

  // Reverse geocode (async, don't block response)
  reverseGeocode(lat, lng).then(async (geo) => {
    const locData = {
      userId: req.user!.id,
      groupId,
      lat,
      lng,
      locality: geo?.locality,
      updatedAt: new Date().toISOString(),
    }
    await setLocation(locData)
    // Also persist to PostgreSQL for audit/GDPR
    await query(
      `INSERT INTO locations (user_id, group_id, lat, lng, locality, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, group_id)
       DO UPDATE SET lat = $3, lng = $4, locality = $5, updated_at = NOW()`,
      [req.user!.id, groupId, lat, lng, geo?.locality],
    )
  })

  res.json({ message: 'Location received' })
})

// PUT /api/locations/me/pause - pause or resume own sharing
router.put('/me/pause', validate(pauseSharingSchema), async (req: AuthRequest, res: Response) => {
  const { sharing } = req.body
  const nextSharing = typeof sharing === 'boolean' ? sharing : false
  const result = await query(
    `UPDATE users SET sharing = $1 WHERE id = $2 RETURNING *`,
    [nextSharing, req.user!.id],
  )
  res.json(result.rows[0])
})

// DELETE /api/locations/me/:groupId — called on member removal
router.delete('/me/:groupId', async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params
  await deleteLocation(req.user!.id, groupId)
  res.json({ message: 'Location cleared' })
})

export default router
