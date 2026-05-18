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

// ── Natural language intent classifier ───────────────────────
type Intent = 'LIST' | 'HEAD' | 'PAUSE' | 'RESUME' | 'HELP' | 'UNKNOWN'

function classifyIntent(message: string): Intent {
  const m = message.toLowerCase().trim()

  // Exact commands
  if (m === 'list') return 'LIST'
  if (m === 'head') return 'HEAD'
  if (m === 'pause') return 'PAUSE'
  if (m === 'resume') return 'RESUME'
  if (m === 'help' || m === 'hi' || m === 'hello') return 'HELP'

  // Natural language patterns
  const listKeywords = ['where', 'location', 'everyone', 'members', 'who', 'group', 'all', 'people', 'see', 'show']
  const headKeywords = ['head', 'leader', 'admin', 'boss', 'in charge', 'who is leading']
  const pauseKeywords = ['pause', 'stop', 'hide', 'private', 'off', 'disable sharing', 'dont share', "don't share"]
  const resumeKeywords = ['resume', 'start', 'share', 'show location', 'enable', 'turn on', 'visible']

  if (headKeywords.some((k) => m.includes(k))) return 'HEAD'
  if (pauseKeywords.some((k) => m.includes(k))) return 'PAUSE'
  if (resumeKeywords.some((k) => m.includes(k))) return 'RESUME'
  if (listKeywords.some((k) => m.includes(k))) return 'LIST'

  return 'UNKNOWN'
}

// ── Look up user by WhatsApp number ──────────────────────────
async function getUserByWhatsApp(waNumber: string) {
  const normalized = waNumber.replace(/\D/g, '')
  const result = await query(
    `SELECT u.*, gm.group_id, gm.role
     FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE u.whatsapp = $1 OR u.phone = $1
     LIMIT 1`,
    [normalized],
  )
  return result.rows[0] || null
}

// ── Command Handlers ──────────────────────────────────────────
async function handleList(to: string, groupId: string, userId: string): Promise<void> {
  const members = await query(
    `SELECT u.name, u.whatsapp, gm.role
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

async function handlePause(to: string, userId: string, groupId: string): Promise<void> {
  await query(
    'UPDATE users SET sharing = FALSE WHERE id = $1',
    [userId],
  )
  await sendMessage(
    to,
    '⏸ Your location sharing has been *paused*. Other members cannot see your location.\n\nReply *RESUME* to start sharing again.',
  )
}

async function handleResume(to: string, userId: string, groupId: string): Promise<void> {
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
⏸ *PAUSE* — Stop sharing your location
▶ *RESUME* — Start sharing your location again
❓ *HELP* — Show this menu

You can also ask naturally, for example:
• _"Where is everyone?"_
• _"Who is in charge?"_
• _"Stop sharing my location"_`,
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
    switch (intent) {
      case 'LIST':
        await handleList(from, user.group_id, user.id)
        break
      case 'HEAD':
        await handleHead(from, user.group_id)
        break
      case 'PAUSE':
        await handlePause(from, user.id, user.group_id)
        break
      case 'RESUME':
        await handleResume(from, user.id, user.group_id)
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
