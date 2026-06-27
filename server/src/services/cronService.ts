import cron from 'node-cron'
import { query } from '../db'
import { io } from './socketService'

export async function startCronJobs() {
  try {
    await query('SELECT 1')
  } catch (err) {
    console.warn(
      '[Cron] Skipping scheduled jobs until the database is reachable:',
      err instanceof Error ? err.message : err,
    )
    return
  }

  // ── Temp Head Expiry — runs every minute ──────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await query(`
        UPDATE temp_head
        SET active = FALSE
        WHERE active = TRUE AND expiry <= NOW()
        RETURNING group_id, user_id AS temp_user_id, granted_by AS original_head_id
      `)

      for (const row of expired.rows) {
        const { group_id, temp_user_id, original_head_id } = row

        // Revert temp head back to member
        await query(
          `UPDATE group_members SET role = 'member'
           WHERE user_id = $1 AND group_id = $2`,
          [temp_user_id, group_id],
        )

        // Re-elevate original head
        await query(
          `UPDATE group_members SET role = 'head'
           WHERE user_id = $1 AND group_id = $2`,
          [original_head_id, group_id],
        )

        // Notify group via socket
        io.to(group_id).emit('head:changed', {
          oldHeadId: temp_user_id,
          newHeadId: original_head_id,
          reason: 'temp_head_expired',
        })

        console.log(
          `[Cron] Temp head expired in group ${group_id}. Head reverted to ${original_head_id}`,
        )
      }
    } catch (err) {
      console.error('[Cron] Temp head expiry error:', err)
    }
  })

  // ── Expired invite tokens cleanup — runs every hour ───────
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await query(`
        UPDATE groups
        SET invite_token = NULL, token_expiry = NULL
        WHERE token_expiry IS NOT NULL AND token_expiry < NOW()
      `)
      if (result.rowCount && result.rowCount > 0) {
        console.log(`[Cron] Cleared ${result.rowCount} expired invite tokens`)
      }
    } catch (err) {
      console.error('[Cron] Token cleanup error:', err)
    }
  })

  // ── GDPR: purge locations > 24h after member removal ──────
  cron.schedule('0 2 * * *', async () => {
    try {
      await query(`
        DELETE FROM locations
        WHERE (user_id, group_id) NOT IN (
          SELECT user_id, group_id FROM group_members
        )
        AND updated_at < NOW() - INTERVAL '24 hours'
      `)
      console.log('[Cron] GDPR location purge complete')
    } catch (err) {
      console.error('[Cron] GDPR purge error:', err)
    }
  })

  console.log('✅ Cron jobs started')
}
