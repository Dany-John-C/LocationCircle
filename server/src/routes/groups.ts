import { Router, Response } from 'express'
import crypto from 'crypto'
import { query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { roleGuard } from '../middleware/roleGuard'

const router = Router()
router.use(authMiddleware)

// POST /api/groups — create group (creator becomes Head)
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'Group name required' })
    return
  }
  const client = await query('SELECT NOW()')
  try {
    const groupResult = await query(
      `INSERT INTO groups (name, head_id) VALUES ($1, $2) RETURNING *`,
      [name.trim(), req.user!.id],
    )
    const group = groupResult.rows[0]

    await query(
      `INSERT INTO group_members (user_id, group_id, role) VALUES ($1, $2, 'head')`,
      [req.user!.id, group.id],
    )

    res.status(201).json(group)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' })
  }
})

// GET /api/groups/:groupId
router.get('/:groupId', async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params
  const result = await query(
    `SELECT g.*,
      json_agg(json_build_object(
        'id', u.id, 'name', u.name, 'email', u.email,
        'avatar_url', u.avatar_url, 'phone', u.phone,
        'whatsapp', u.whatsapp, 'sharing', u.sharing,
        'role', gm.role, 'joined_at', gm.joined_at
      )) AS members
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
  roleGuard('head', 'temp_head'),
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

// POST /api/groups/join/:token — join via invite link
router.post('/join/:token', async (req: AuthRequest, res: Response) => {
  const { token } = req.params
  const result = await query(
    `SELECT * FROM groups WHERE invite_token = $1 AND token_expiry > NOW()`,
    [token],
  )
  if (!result.rows.length) {
    res.status(400).json({ error: 'Invalid or expired invite link' })
    return
  }
  const group = result.rows[0]

  // Check already a member
  const existing = await query(
    `SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = $2`,
    [req.user!.id, group.id],
  )
  if (existing.rows.length) {
    res.status(409).json({ error: 'Already a member of this group' })
    return
  }

  await query(
    `INSERT INTO group_members (user_id, group_id, role) VALUES ($1, $2, 'member')`,
    [req.user!.id, group.id],
  )

  res.json({ group, message: 'Joined group successfully' })
})

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
  async (req: AuthRequest, res: Response) => {
    const { groupId } = req.params
    const { userId, expiryMinutes = 60 } = req.body
    const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000)

    // Deactivate existing temp head if any
    await query(
      `UPDATE temp_head SET active = FALSE WHERE group_id = $1 AND active = TRUE`,
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

export default router
