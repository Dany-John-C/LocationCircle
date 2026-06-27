import { Response, NextFunction } from 'express'
import { query } from '../db'
import type { AuthRequest } from './authMiddleware'

type RequiredRole = 'head' | 'temp_head' | 'member'

export function roleGuard(...allowedRoles: RequiredRole[]) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const userId = req.user?.id
    const groupId = req.params.groupId || req.body.groupId

    if (!userId || !groupId) {
      res.status(400).json({ error: 'Missing user or group context' })
      return
    }

    try {
      const result = await query(
        'SELECT role FROM group_members WHERE user_id = $1 AND group_id = $2',
        [userId, groupId],
      )

      if (!result.rows.length) {
        res.status(403).json({ error: 'Not a member of this group' })
        return
      }

      const { role } = result.rows[0]

      // head can do everything head OR temp_head can do
      const effectiveRoles =
        role === 'head' ? ['head', 'temp_head'] : [role]

      const permitted = allowedRoles.some((r) => effectiveRoles.includes(r))
      if (!permitted) {
        res.status(403).json({
          error: `Requires role: ${allowedRoles.join(' or ')}. Your role: ${role}`,
        })
        return
      }

      next()
    } catch (err) {
      res.status(500).json({ error: 'Role check failed' })
    }
  }
}
