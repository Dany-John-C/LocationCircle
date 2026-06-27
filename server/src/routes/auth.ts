import { Router, Request, Response } from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { validate, googleAuthSchema } from '../middleware/validate'
import { getFirebaseAuth } from '../services/firebaseService'

const router = Router()

// POST /api/auth/google — verify Firebase ID token, return JWT
router.post('/google', validate(googleAuthSchema), async (req: Request, res: Response) => {
  const { idToken } = req.body
  if (!idToken) {
    res.status(400).json({ error: 'Firebase ID token required' })
    return
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken)
    const { uid, email, name, picture } = decoded

    if (!email) {
      res.status(400).json({ error: 'Email not found in token' })
      return
    }

    // Upsert user
    const result = await query(
      `INSERT INTO users (firebase_uid, name, email, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (firebase_uid)
       DO UPDATE SET
         name = EXCLUDED.name,
         avatar_url = EXCLUDED.avatar_url,
         updated_at = NOW()
       RETURNING *`,
      [uid, name || email.split('@')[0], email, picture || null],
    )

    const user = result.rows[0]
    const jwtOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as SignOptions['expiresIn'],
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, firebase_uid: uid },
      process.env.JWT_SECRET!,
      jwtOptions,
    )

    res.json({ user, token })
  } catch (err) {
    console.error('[Auth] Google sign-in error:', err)
    const message = err instanceof Error ? err.message : ''
    if (
      message.includes('Firebase Admin credentials') ||
      message.includes('Failed to parse private key') ||
      message.includes('invalid-credential')
    ) {
      res.status(500).json({ error: 'Firebase authentication is not configured' })
      return
    }
    res.status(401).json({ error: 'Invalid Firebase token' })
  }
})

// GET /api/auth/me — verify current session
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await query('SELECT * FROM users WHERE id = $1', [req.user!.id])
  if (!result.rows.length) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ user: result.rows[0] })
})

// POST /api/auth/logout
router.post('/logout', authMiddleware, (_req, res: Response) => {
  res.json({ message: 'Logged out successfully' })
})

export default router
