import { Router, Response } from 'express'
import { query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()
router.use(authMiddleware)

// GET /api/users/me
router.get('/me', async (req: AuthRequest, res: Response) => {
  const result = await query('SELECT * FROM users WHERE id = $1', [req.user!.id])
  if (!result.rows.length) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json(result.rows[0])
})

// PUT /api/users/me
router.put('/me', async (req: AuthRequest, res: Response) => {
  const { name, phone, whatsapp, avatar_url, font_size, sharing } = req.body
  const result = await query(
    `UPDATE users SET
       name       = COALESCE($1, name),
       phone      = COALESCE($2, phone),
       whatsapp   = COALESCE($3, whatsapp),
       avatar_url = COALESCE($4, avatar_url),
       font_size  = COALESCE($5, font_size),
       sharing    = COALESCE($6, sharing),
       updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [name, phone, whatsapp, avatar_url, font_size, sharing, req.user!.id],
  )
  res.json(result.rows[0])
})

// GET /api/users/me/groups
router.get('/me/groups', async (req: AuthRequest, res: Response) => {
  const result = await query(
    `SELECT g.*, gm.role, gm.joined_at
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY gm.joined_at DESC`,
    [req.user!.id],
  )
  res.json(result.rows)
})

export default router
