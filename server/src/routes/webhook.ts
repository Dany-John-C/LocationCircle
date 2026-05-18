import { Router, Request, Response } from 'express'
import { handleIncomingMessage } from '../services/whatsappService'

const router = Router()

// GET /api/webhook/whatsapp — Meta webhook verification
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] WhatsApp webhook verified')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// POST /api/webhook/whatsapp — receive incoming messages
router.post('/whatsapp', async (req: Request, res: Response) => {
  // Always respond 200 fast to Meta (within 20s SLA)
  res.sendStatus(200)

  try {
    const body = req.body
    if (body.object !== 'whatsapp_business_account') return

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages?.length) return

    for (const message of messages) {
      if (message.type !== 'text') continue
      const from: string = message.from
      const text: string = message.text?.body || ''

      console.log(`[WhatsApp] From ${from}: "${text}"`)
      await handleIncomingMessage(from, text)
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', err)
    // Don't throw — response already sent
  }
})

export default router
