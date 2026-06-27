import axios from 'axios'
import { query } from '../db'
import { getGroupLocations } from './redisService'

const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!
const BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}/${PHONE_NUMBER_ID}/messages`

// ── Send a WhatsApp text message ──────────────────────────────
export async function sendMessage(to: string, text: string): Promise<void> {
  try {
    await axios.post(
      BASE_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (err: unknown) {
    const error = err as { response?: { data: unknown } }
    console.error('[WhatsApp] Send error:', error.response?.data || err)
  }
}

// ── Haversine straight-line distance (km) ────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── "Where is [Name]?" parser (FR-WA-02) ─────────────────────
// Returns the queried name, or null if this isn't a single-person query
// (group-wide phrasings like "where is everyone" fall through to LIST).
function parseWhereQuery(message: string): string | null {
  const m = message.toLowerCase().trim()
  if (!m.includes('where')) return null
  if (/(everyone|every one|\ball\b|members|people|group|anybody|everybody)/.test(m)) return null
  const match = m.match(/where\s+(?:is|are|'?s)?\s*(.+)/)
  if (!match) return null
  const name = match[1]
    .replace(/\b(right now|now|currently|located|located at|at the moment|please)\b/g, '')
    .replace(/[?.!]/g, '')
    .trim()
  return name.length ? name : null
}

// ── Natural language intent classifier ───────────────────────
type Intent = 'LIST' | 'HEAD' | 'GROUPS' | 'PAUSE' | 'RESUME' | 'HELP' | 'UNKNOWN'

function classifyIntent(message: string): Intent {
  const m = message.toLowerCase().trim()

  // Exact commands
  if (m === 'list') return 'LIST'
  if (m === 'head') return 'HEAD'
  if (m === 'pause') return 'PAUSE'
  if (m === 'resume') return 'RESUME'
  if (m === 'groups' || m === 'circles' || m === 'switch') return 'GROUPS'
  if (m === 'help' || m === 'hi' || m === 'hello') return 'HELP'

  // Natural language patterns
  const groupsKeywords = ['groups', 'circles', 'switch group', 'switch circle', 'change group', 'change circle', 'my groups', 'my circles', 'other group', 'list groups']
  const headKeywords = ['head', 'leader', 'admin', 'boss', 'in charge', 'who is leading']
  const pauseKeywords = ['pause', 'stop', 'hide', 'private', 'off', 'disable sharing', 'dont share', "don't share"]
  const resumeKeywords = ['resume', 'start', 'share', 'show location', 'enable', 'turn on', 'visible']
  const listKeywords = ['where', 'location', 'everyone', 'members', 'who', 'group', 'all', 'people', 'see', 'show']

  if (groupsKeywords.some((k) => m.includes(k))) return 'GROUPS'
  if (headKeywords.some((k) => m.includes(k))) return 'HEAD'
  if (pauseKeywords.some((k) => m.includes(k))) return 'PAUSE'
  if (resumeKeywords.some((k) => m.includes(k))) return 'RESUME'
  if (listKeywords.some((k) => m.includes(k))) return 'LIST'

  return 'UNKNOWN'
}

// "USE 2" / "switch 2" / bare "2" → switch to that circle number
function parseUseGroup(message: string): number | null {
  const m = message.toLowerCase().trim()
  const cmd = m.match(/^(?:use|switch|select|change)(?:\s+to)?\s+(?:group|circle\s*)?#?\s*(\d+)$/)
  if (cmd) return parseInt(cmd[1], 10)
  if (/^#?\d{1,2}$/.test(m)) return parseInt(m.replace('#', ''), 10)
  return null
}

// ── Look up user by WhatsApp number ──────────────────────────
// WhatsApp delivers `from` as digits only (e.g. "447700900123") while users
// may store their number with "+", spaces or dashes. Compare on the
// digit-only form of both columns so the formats line up.
async function getUserByWhatsApp(waNumber: string) {
  const normalized = waNumber.replace(/\D/g, '')
  const ures = await query(
    `SELECT * FROM users
     WHERE regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g') = $1
        OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
     LIMIT 1`,
    [normalized],
  )
  const user = ures.rows[0]
  if (!user) return null

  // All circles the user belongs to (oldest first)
  const gms = await query(
    `SELECT g.id, g.name, gm.role
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY gm.joined_at ASC`,
    [user.id],
  )
  const groups = gms.rows as { id: string; name: string; role: string }[]

  // Active circle = the one the user selected via USE, else the oldest
  const active = groups.find((g) => g.id === user.bot_group_id) ?? groups[0]
  return {
    ...user,
    groups,
    group_id: active?.id ?? null,
    role: active?.role ?? null,
  }
}

// ── Command Handlers ──────────────────────────────────────────
async function handleList(to: string, groupId: string, userId: string): Promise<void> {
  const members = await query(
    `SELECT u.id, u.name, u.whatsapp, gm.role
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId],
  )

  if (!members.rows.length) {
    await sendMessage(to, '📍 No members found in your group.')
    return
  }

  const userIds = members.rows.map((m: { id: string }) => m.id)
  const locations = await getGroupLocations(groupId, userIds)
  const locMap = new Map(locations.map((l) => [l.userId, l]))

  const lines = members.rows.map((m: { name: string; id: string; role: string }) => {
    const loc = locMap.get(m.id)
    const badge = m.role === 'head' ? '★' : m.role === 'temp_head' ? '◎' : '•'
    const locStr = loc ? `${loc.locality || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}` : 'No recent location'
    return `${badge} *${m.name}*: ${locStr}`
  })

  await sendMessage(
    to,
    `📍 *LocationCircle — Group Members*\n\n${lines.join('\n')}\n\n_Updated just now_`,
  )
}

async function handleWhereIs(
  to: string,
  groupId: string,
  viewerId: string,
  name: string,
): Promise<void> {
  const members = await query(
    `SELECT u.id, u.name, gm.role
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId],
  )

  const q = name.toLowerCase()
  const target = members.rows.find((m: { name: string }) => {
    const full = m.name.toLowerCase()
    const first = full.split(' ')[0]
    return full.includes(q) || q.includes(first)
  })

  if (!target) {
    await sendMessage(
      to,
      `🤔 I couldn't find "${name}" in your group. Reply *LIST* to see everyone.`,
    )
    return
  }

  const userIds = members.rows.map((m: { id: string }) => m.id)
  const locations = await getGroupLocations(groupId, userIds)
  const locMap = new Map(locations.map((l) => [l.userId, l]))
  const targetLoc = locMap.get(target.id)

  if (!targetLoc) {
    await sendMessage(to, `📍 *${target.name}* has no recent location to share.`)
    return
  }

  const badge =
    target.role === 'head' ? ' (Head)' : target.role === 'temp_head' ? ' (Temp Head)' : ''
  const where =
    targetLoc.locality || `${targetLoc.lat.toFixed(4)}, ${targetLoc.lng.toFixed(4)}`

  let distanceLine = ''
  const viewerLoc = locMap.get(viewerId)
  if (viewerLoc && viewerId !== target.id) {
    const km = haversineKm(viewerLoc.lat, viewerLoc.lng, targetLoc.lat, targetLoc.lng)
    const mins = Math.max(1, Math.round((km / 30) * 60))
    distanceLine = `\n${km.toFixed(1)} km from you · ETA ~${mins} min by car`
  }

  const mapUrl = `https://www.google.com/maps?q=${targetLoc.lat},${targetLoc.lng}`
  await sendMessage(to, `📍 *${target.name}${badge}* is in ${where}${distanceLine}\n${mapUrl}`)
}

async function handleHead(to: string, groupId: string): Promise<void> {
  const result = await query(
    `SELECT u.name, u.phone FROM groups g
     JOIN users u ON u.id = g.head_id
     WHERE g.id = $1`,
    [groupId],
  )
  const head = result.rows[0]

  const tempResult = await query(
    `SELECT u.name, th.expiry FROM temp_head th
     JOIN users u ON u.id = th.user_id
     WHERE th.group_id = $1 AND th.active = TRUE LIMIT 1`,
    [groupId],
  )
  const tempHead = tempResult.rows[0]

  let reply = `👑 *Group Head:* ${head?.name ?? 'Unknown'}\n`
  if (tempHead) {
    const expiry = new Date(tempHead.expiry).toLocaleTimeString()
    reply += `◎ *Temporary Head:* ${tempHead.name} (until ${expiry})`
  }

  await sendMessage(to, reply)
}

type BotGroup = { id: string; name: string; role: string }

async function handleGroups(
  to: string,
  user: { group_id: string | null; groups: BotGroup[] },
): Promise<void> {
  const lines = user.groups.map((g, i) => {
    const current = g.id === user.group_id ? ' ✅ _(current)_' : ''
    const badge = g.role === 'head' ? ' 👑' : g.role === 'temp_head' ? ' ◎' : ''
    return `${i + 1}. *${g.name}*${badge}${current}`
  })
  await sendMessage(
    to,
    `🔵 *Your circles*\n\n${lines.join('\n')}\n\nReply *USE <number>* to switch (e.g. _USE 2_).`,
  )
}

async function handleUseGroup(
  to: string,
  user: { id: string; groups: BotGroup[] },
  n: number,
): Promise<void> {
  if (n < 1 || n > user.groups.length) {
    await sendMessage(
      to,
      `⚠️ Please pick a number between 1 and ${user.groups.length}. Reply *GROUPS* to see them.`,
    )
    return
  }
  const target = user.groups[n - 1]
  await query('UPDATE users SET bot_group_id = $1 WHERE id = $2', [target.id, user.id])
  await sendMessage(to, `✅ Switched to *${target.name}*. Reply *LIST* to see its members.`)
}

async function handlePause(to: string, userId: string): Promise<void> {
  await query(
    'UPDATE users SET sharing = FALSE WHERE id = $1',
    [userId],
  )
  await sendMessage(
    to,
    '⏸ Your location sharing has been *paused*. Other members cannot see your location.\n\nReply *RESUME* to start sharing again.',
  )
}

async function handleResume(to: string, userId: string): Promise<void> {
  await query(
    'UPDATE users SET sharing = TRUE WHERE id = $1',
    [userId],
  )
  await sendMessage(
    to,
    '▶ Your location sharing has been *resumed*. Your group can see your location again.',
  )
}

async function handleHelp(to: string): Promise<void> {
  await sendMessage(
    to,
    `👋 *LocationCircle Bot Commands*

📍 *LIST* — See all members and their locations
👑 *HEAD* — Who is the current group head
🔵 *GROUPS* — List your circles
🔁 *USE <number>* — Switch to another circle
⏸ *PAUSE* — Stop sharing your location
▶ *RESUME* — Start sharing your location again
❓ *HELP* — Show this menu

You can also ask naturally, for example:
• _"Where is everyone?"_
• _"Where is Sara?"_
• _"Switch group"_ → then _USE 2_`,
  )
}

// ── Main message dispatcher ───────────────────────────────────
export async function handleIncomingMessage(
  from: string,
  messageBody: string,
): Promise<void> {
  const intent = classifyIntent(messageBody)

  // Look up user in database
  const user = await getUserByWhatsApp(from)

  if (!user) {
    await sendMessage(
      from,
      "⚠️ Your number isn't linked to a LocationCircle account.\n\nPlease add your WhatsApp number in the app's Settings page.",
    )
    return
  }

  try {
    // Not in any circle yet
    if (!user.groups.length) {
      await sendMessage(
        from,
        "📍 You're not in any circle yet. Open the LocationCircle app to create or join one.",
      )
      return
    }

    // "USE 2" / bare number → switch active circle
    const useN = parseUseGroup(messageBody)
    if (useN !== null) {
      await handleUseGroup(from, user, useN)
      return
    }

    // "Where is [Name]?" takes precedence over the generic LIST intent
    const whoQuery = parseWhereQuery(messageBody)
    if (whoQuery) {
      await handleWhereIs(from, user.group_id, user.id, whoQuery)
      return
    }

    switch (intent) {
      case 'LIST':
        await handleList(from, user.group_id, user.id)
        break
      case 'HEAD':
        await handleHead(from, user.group_id)
        break
      case 'GROUPS':
        await handleGroups(from, user)
        break
      case 'PAUSE':
        await handlePause(from, user.id)
        break
      case 'RESUME':
        await handleResume(from, user.id)
        break
      case 'HELP':
        await handleHelp(from)
        break
      default:
        await sendMessage(
          from,
          "🤔 I didn't understand that. Reply *HELP* to see available commands.",
        )
    }
  } catch (err) {
    console.error('[WhatsApp] Handler error:', err)
    await sendMessage(from, '⚠️ Something went wrong. Please try again.')
  }
}
