import { z } from 'zod'
import { Request, Response, NextFunction } from 'express'

// ── Reusable validation middleware ────────────────────────────
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.flatten()
      res.status(400).json({
        error: 'Validation failed',
        details: errors.fieldErrors,
      })
      return
    }
    req.body = result.data
    next()
  }
}

// ── Schemas ───────────────────────────────────────────────────

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token required'),
})

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name required').max(100, 'Group name too long'),
})

export const inviteSchema = z.object({
  expiryHours: z.number().int().min(1).max(720).optional().default(168),
})

export const transferHeadSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
})

export const tempHeadSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  expiryMinutes: z.number().int().min(1).max(43200).optional().default(60),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  font_size: z.number().int().min(12).max(32).optional(),
  sharing: z.boolean().optional(),
  notif_prefs: z
    .object({
      push: z.boolean(),
      whatsapp: z.boolean(),
      email: z.boolean(),
    })
    .optional(),
})

export const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  groupId: z.string().uuid('Invalid group ID'),
})

export const etaRequestSchema = z.object({
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
})

export const pauseSharingSchema = z.object({
  sharing: z.boolean(),
})
