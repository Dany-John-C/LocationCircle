import { Router, Response } from 'express'
import crypto from 'crypto'
import { getClient, query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { roleGuard } from '../middleware/roleGuard'
import {
  validate,
  createGroupSchema,
  inviteSchema,
  transferHeadSchema,
  tempHeadSchema,
} from '../middleware/validate'
import { deleteLocation } from '../services/redisService'
import { io } from '../services/socketService'

const router = Router()
router.use(authMiddleware)

// POST /api/groups — create group (creator becomes Head)
router.post('/', validate(createGroupSchema), async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'Group name required' })
    return
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')
    const groupResult = await client.query(
      `INSERT INTO groups (name, head_id) VALUES ($1, $2) RETURNING *`,
      [name.trim(), req.user!.id],
    )
    const group = groupResult.rows[0]

    await client.query(
      `INSERT INTO group_members (user_id, group_id, role) VALUES ($1, $2, 'head')`,
      [req.user!.id, group.id],
    )

    await client.query('COMMIT')
    res.status(201).json(group)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: 'Failed to create group' })
  } finally {
    client.release()
  }
})

// GET /api/groups/:groupId
router.get('/:groupId', async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params
  const membership = await query(
    `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [req.user!.id, groupId],
  )
  if (!membership.rows.length) {
    res.status(403).json({ error: 'Not a member of this group' })
    return
  }

  const result = await query(
    `SELECT g.*,
      json_agg(json_build_object(
        'id', u.id, 'name', u.name, 'email', u.email,
        'avatar_url', u.avatar_url, 'phone', u.phone,
        'whatsapp', u.whatsapp, 'sharing', u.sharing,
        'role', gm.role, 'joined_at', gm.joined_at
      ) ORDER BY
        CASE gm.role WHEN 'head' THEN 0 WHEN 'temp_head' THEN 1 ELSE 2 END,
        gm.joined_at
      ) AS members
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     JOIN users u ON u.id = gm.user_id
     WHERE g.id = $1
     GROUP BY g.id`,
    [groupId],
  )
  if (!result.rows.length) {
    res.status(404).json({ error: 'Group not found' })
    return
  }
  res.json(result.rows[0])
})

// POST /api/groups/:groupId/invite — generate invite token (Head only)
router.post(
  '/:groupId/invite',
  roleGuard('head'),
  validate(inviteSchema),
  async (req: AuthRequest, res: Response) => {
    const { groupId } = req.params
    const { expiryHours = 168 } = req.body // default 7 days
    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + expiryHours * 3600 * 1000)

    await query(
      `UPDATE groups SET invite_token = $1, token_expiry = $2 WHERE id = $3`,
      [token, expiry, groupId],
    )

    res.json({
      invite_url: `${process.env.CLIENT_URL}/join/${token}`,
      token,
      expires_at: expiry,
    })
  },
)

// POST /api/groups/join/:token — request to join via invite link.
// Creates a PENDING request the group Head must approve. The link stays
// reusable until it expires, so it can be shared with several people.
router.post('/join/:token', async (req: AuthRequest, res: Response) => {
  const { token } = req.params
  const result = await query(
    `SELECT id, name FROM groups WHERE invite_token = $1 AND token_expiry > NOW()`,
    [token],
  )
  if (!result.rows.length) {
    res.status(400).json({ error: 'Invalid or expired invite link' })
    return
  }
  const group = result.rows[0]

  // Already a member?
  const existing = await query(
    `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [req.user!.id, group.id],
  )
  if (existing.rows.length) {
    res.status(409).json({ error: 'Already a member of this group' })
    return
  }

  // Create (or refresh) a pending join request
  await query(
    `INSERT INTO join_requests (group_id, user_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (group_id, user_id)
     DO UPDATE SET status = 'pending', created_at = NOW()`,
    [group.id, req.user!.id],
  )

  res.status(202).json({
    status: 'pending',
    group: { id: group.id, name: group.name },
    message: 'Request sent — waiting for the group Head to approve.',
  })
})

// GET /api/groups/:groupId/requests — list pending join requests (Head only)
router.get(
  '/:groupId/requests',
  roleGuard('head'),
  async (req: AuthRequest, res: Response) => {
    const { groupId } = req.params
    const result = await query(
      `SELECT jr.user_id, jr.created_at, u.name, u.email, u.avatar_url
       FROM join_requests jr
       JOIN users u ON u.id = jr.user_id
       WHERE jr.group_id = $1 AND jr.status = 'pending'
       ORDER BY jr.created_at ASC`,
      [groupId],
    )
    res.json(result.rows)
  },
)

// POST /api/groups/:groupId/requests/:userId/approve — admit member (Head only)
router.post(
  '/:groupId/requests/:userId/approve',
  roleGuard('head'),
  async (req: AuthRequest, res: Response) => {
    const { groupId, userId } = req.params
    const pending = await query(
      `SELECT 1 FROM join_requests
       WHERE group_id = $1 AND user_id = $2 AND status = 'pending'`,
      [groupId, userId],
    )
    if (!pending.rows.length) {
      res.status(404).json({ error: 'No pending request from this user' })
      return
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO group_members (user_id, group_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT (user_id, group_id) DO NOTHING`,
        [userId, groupId],
      )
      await client.query(
        `DELETE FROM join_requests WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId],
      )
      await client.query('COMMIT')
      res.json({ message: 'Request approved', userId })
    } catch {
      await client.query('ROLLBACK')
      res.status(500).json({ error: 'Failed to approve request' })
    } finally {
      client.release()
    }
  },
)

// POST /api/groups/:groupId/requests/:userId/deny — reject request (Head only)
router.post(
  '/:groupId/requests/:userId/deny',
  roleGuard('head'),
  async (req: AuthRequest, res: Response) => {
    const { groupId, userId } = req.params
    await query(
      `DELETE FROM join_requests WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId],
    )
    res.json({ message: 'Request denied', userId })
  },
)

// PUT /api/groups/:groupId/head - transfer permanent headship
router.put(
  '/:groupId/head',
  roleGuard('head'),
  validate(transferHeadSchema),
  async (req: AuthRequest, res: Response) => {
    const { groupId } = req.params
    const { userId } = req.body
    if (!userId) {
      res.status(400).json({ error: 'userId required' })
      return
    }

    const target = await query(
      `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
      [userId, groupId],
    )
    if (!target.rows.length) {
      res.status(404).json({ error: 'Target user is not a group member' })
      return
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE groups SET head_id = $1 WHERE id = $2`,
        [userId, groupId],
      )
      await client.query(
        `UPDATE group_members SET role = 'member'
         WHERE group_id = $1 AND role IN ('head', 'temp_head')`,
        [groupId],
      )
      await client.query(
        `UPDATE group_members SET role = 'head'
         WHERE user_id = $1 AND group_id = $2`,
        [userId, groupId],
      )
      await client.query(
        `UPDATE temp_head SET active = FALSE WHERE group_id = $1 AND active = TRUE`,
        [groupId],
      )
      await client.query('COMMIT')
      res.json({ message: 'Head transferred', newHeadId: userId })
    } catch {
      await client.query('ROLLBACK')
      res.status(500).json({ error: 'Failed to transfer headship' })
    } finally {
      client.release()
    }
  },
)

// DELETE /api/groups/:groupId/members/:memberId — remove member (Head only)
router.delete(
  '/:groupId/members/:memberId',
  roleGuard('head'),
  async (req: AuthRequest, res: Response) => {
    const { groupId, memberId } = req.params
    if (memberId === req.user!.id) {
      res.status(400).json({ error: 'Head cannot remove themselves' })
      return
    }
    await query(
      `DELETE FROM group_members WHERE user_id = $1 AND group_id = $2`,
      [memberId, groupId],
    )
    res.json({ message: 'Member removed' })
  },
)

// POST /api/groups/:groupId/temp-head — assign Temporary Head
router.post(
  '/:groupId/temp-head',
  roleGuard('head'),
  validate(tempHeadSchema),
  async (req: AuthRequest, res: Response) => {
    const { groupId } = req.params
    const { userId, expiryMinutes = 60 } = req.body
    if (!userId) {
      res.status(400).json({ error: 'userId required' })
      return
    }

    const member = await query(
      `SELECT role FROM group_members WHERE user_id = $1 AND group_id = $2`,
      [userId, groupId],
    )
    if (!member.rows.length) {
      res.status(404).json({ error: 'Target user is not a group member' })
      return
    }
    if (member.rows[0].role === 'head') {
      res.status(400).json({ error: 'Permanent Head is already in charge' })
      return
    }

    const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000)

    // Deactivate existing temp head if any
    await query(
      `UPDATE temp_head SET active = FALSE WHERE group_id = $1 AND active = TRUE`,
      [groupId],
    )
    await query(
      `UPDATE group_members SET role = 'member'
       WHERE group_id = $1 AND role = 'temp_head'`,
      [groupId],
    )

    await query(
      `INSERT INTO temp_head (group_id, user_id, granted_by, expiry)
       VALUES ($1, $2, $3, $4)`,
      [groupId, userId, req.user!.id, expiry],
    )

    await query(
      `UPDATE group_members SET role = 'temp_head'
       WHERE user_id = $1 AND group_id = $2`,
      [userId, groupId],
    )

    res.json({ message: 'Temporary Head assigned', expires_at: expiry })
  },
)

// DELETE /api/groups/:groupId/temp-head - revoke active Temporary Head
router.delete(
  '/:groupId/temp-head',
  roleGuard('head'),
  async (req: AuthRequest, res: Response) => {
    const { groupId } = req.params
    const result = await query(
      `UPDATE temp_head
       SET active = FALSE
       WHERE group_id = $1 AND active = TRUE
       RETURNING user_id`,
      [groupId],
    )

    for (const row of result.rows) {
      await query(
        `UPDATE group_members SET role = 'member'
         WHERE user_id = $1 AND group_id = $2`,
        [row.user_id, groupId],
      )
    }

    res.json({ message: 'Temporary Head revoked' })
  },
)

// POST /api/groups/:groupId/leave — member voluntarily leaves the group
router.post('/:groupId/leave', async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params
  const userId = req.user!.id

  // Check membership
  const membership = await query(
    `SELECT role FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [userId, groupId],
  )
  if (!membership.rows.length) {
    res.status(404).json({ error: 'Not a member of this group' })
    return
  }

  // Head cannot leave without transferring headship first
  if (membership.rows[0].role === 'head') {
    res.status(400).json({ error: 'Group Head must transfer headship before leaving' })
    return
  }

  // If leaving user is temp_head, revoke temp head first
  if (membership.rows[0].role === 'temp_head') {
    await query(
      `UPDATE temp_head SET active = FALSE WHERE group_id = $1 AND user_id = $2 AND active = TRUE`,
      [groupId, userId],
    )
  }

  // Remove from group
  await query(
    `DELETE FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [userId, groupId],
  )

  // Clean up location data
  await query(
    `DELETE FROM locations WHERE user_id = $1 AND group_id = $2`,
    [userId, groupId],
  )

  res.json({ message: 'Left the group' })
})

// DELETE /api/groups/:groupId — delete the entire circle (Head only).
// Cascades group_members, locations, temp_head, join_requests and
// notifications (all FK ON DELETE CASCADE), then clears Redis positions.
router.delete('/:groupId', roleGuard('head'), async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params

  // Capture members first so we can purge their Redis location keys
  const members = await query(
    `SELECT user_id FROM group_members WHERE group_id = $1`,
    [groupId],
  )
  const userIds = members.rows.map((r: { user_id: string }) => r.user_id)

  await query(`DELETE FROM groups WHERE id = $1`, [groupId])

  await Promise.allSettled(userIds.map((id: string) => deleteLocation(id, groupId)))
  io?.to(groupId).emit('group:deleted', { groupId })

  res.json({ message: 'Circle deleted' })
})

export default router
