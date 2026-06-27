import { Router, Response } from 'express'
import { query, getClient } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validate, updateUserSchema } from '../middleware/validate'
import { deleteLocation } from '../services/redisService'
import { deleteFirebaseUser } from '../services/firebaseService'
import { io } from '../services/socketService'

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
router.put('/me', validate(updateUserSchema), async (req: AuthRequest, res: Response) => {
  const { name, phone, whatsapp, avatar_url, font_size, sharing, notif_prefs } = req.body
  const result = await query(
    `UPDATE users SET
       name        = COALESCE($1, name),
       phone       = COALESCE($2, phone),
       whatsapp    = COALESCE($3, whatsapp),
       avatar_url  = COALESCE($4, avatar_url),
       font_size   = COALESCE($5, font_size),
       sharing     = COALESCE($6, sharing),
       notif_prefs = COALESCE($7::jsonb, notif_prefs),
       updated_at  = NOW()
     WHERE id = $8
     RETURNING *`,
    [
      name,
      phone,
      whatsapp,
      avatar_url,
      font_size,
      sharing,
      notif_prefs ? JSON.stringify(notif_prefs) : null,
      req.user!.id,
    ],
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

// GET /api/users/me/requests — my own pending join requests
router.get('/me/requests', async (req: AuthRequest, res: Response) => {
  const result = await query(
    `SELECT jr.group_id, jr.status, jr.created_at, g.name AS group_name
     FROM join_requests jr
     JOIN groups g ON g.id = jr.group_id
     WHERE jr.user_id = $1 AND jr.status = 'pending'
     ORDER BY jr.created_at DESC`,
    [req.user!.id],
  )
  res.json(result.rows)
})

// DELETE /api/users/me — GDPR right to erasure (FR-SET-05, AC-12)
// Deletes the user and ALL associated data: group memberships, locations
// (PostgreSQL + Redis), temp-head grants, notifications, and the Firebase
// auth account. Groups the user heads are reassigned to the next member, or
// deleted entirely if the user was the only member.
router.delete('/me', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  const userRow = await query('SELECT firebase_uid FROM users WHERE id = $1', [userId])
  if (!userRow.rows.length) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  const firebaseUid: string = userRow.rows[0].firebase_uid

  // Groups the user belongs to — needed for Redis cleanup after the txn
  const groupsRes = await query(
    'SELECT group_id FROM group_members WHERE user_id = $1',
    [userId],
  )
  const groupIds: string[] = groupsRes.rows.map((r: { group_id: string }) => r.group_id)
  const reassignments: { groupId: string; newHeadId: string }[] = []

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Re-home any groups this user heads (head_id has ON DELETE RESTRICT)
    const headed = await client.query('SELECT id FROM groups WHERE head_id = $1', [userId])
    for (const g of headed.rows as { id: string }[]) {
      const next = await client.query(
        `SELECT user_id FROM group_members
         WHERE group_id = $1 AND user_id <> $2
         ORDER BY joined_at ASC LIMIT 1`,
        [g.id, userId],
      )
      if (next.rows.length) {
        const newHeadId: string = next.rows[0].user_id
        await client.query(
          `UPDATE group_members SET role = 'member'
           WHERE group_id = $1 AND role IN ('head', 'temp_head')`,
          [g.id],
        )
        await client.query(
          `UPDATE group_members SET role = 'head' WHERE group_id = $1 AND user_id = $2`,
          [g.id, newHeadId],
        )
        await client.query(
          `UPDATE temp_head SET active = FALSE WHERE group_id = $1 AND active = TRUE`,
          [g.id],
        )
        await client.query('UPDATE groups SET head_id = $1 WHERE id = $2', [newHeadId, g.id])
        reassignments.push({ groupId: g.id, newHeadId })
      } else {
        // Sole member — remove the whole group (cascades members/locations/temp_head)
        await client.query('DELETE FROM groups WHERE id = $1', [g.id])
      }
    }

    // Remove temp-head grants issued BY this user (granted_by has no cascade)
    await client.query('DELETE FROM temp_head WHERE granted_by = $1 OR user_id = $1', [userId])

    // Delete the user — cascades group_members, locations, notifications
    await client.query('DELETE FROM users WHERE id = $1', [userId])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[Users] Account deletion failed:', err)
    res.status(500).json({ error: 'Failed to delete account' })
    return
  } finally {
    client.release()
  }

  // Best-effort external cleanup (outside the transaction)
  await Promise.allSettled(groupIds.map((gid) => deleteLocation(userId, gid)))
  await deleteFirebaseUser(firebaseUid)

  // Notify groups whose head was reassigned
  for (const { groupId, newHeadId } of reassignments) {
    io?.to(groupId).emit('head:changed', {
      oldHeadId: userId,
      newHeadId,
      reason: 'head_account_deleted',
    })
  }

  res.json({ message: 'Account and all associated data deleted' })
})

export default router
