import { Router, Response } from 'express'
import { query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import {
  setLocation,
  getGroupLocations,
  deleteLocation,
} from '../services/redisService'
import { reverseGeocode } from '../services/mapsService'

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

// PUT /api/locations/me — update own location (also done via socket, this is REST fallback)
router.put('/me', async (req: AuthRequest, res: Response) => {
  const { lat, lng, groupId } = req.body
  if (lat == null || lng == null || !groupId) {
    res.status(400).json({ error: 'lat, lng, groupId required' })
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

// DELETE /api/locations/me/:groupId — called on member removal
router.delete('/me/:groupId', async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params
  await deleteLocation(req.user!.id, groupId)
  res.json({ message: 'Location cleared' })
})

export default router
