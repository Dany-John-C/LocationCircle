import admin from 'firebase-admin'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import '../config/env'

/**
 * Build the Admin SDK credential.
 *
 * Preference order:
 *  1. FIREBASE_SERVICE_ACCOUNT — path to the downloaded service-account JSON
 *     (best for local dev: project_id/client_email/private_key always agree).
 *  2. Discrete env vars FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 *     FIREBASE_PRIVATE_KEY (best for hosting where you can't ship a file).
 */
function buildCredential(): admin.credential.Credential {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT
  if (saPath) {
    const resolved = path.isAbsolute(saPath)
      ? saPath
      : path.resolve(process.cwd(), saPath)
    if (existsSync(resolved)) {
      const json = JSON.parse(readFileSync(resolved, 'utf-8'))
      return admin.credential.cert(json)
    }
    console.warn(`[Firebase] FIREBASE_SERVICE_ACCOUNT set but file not found: ${resolved}`)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Firebase Admin credentials are not configured')
  }

  return admin.credential.cert({ projectId, privateKey, clientEmail })
}

/**
 * Lazily initialise the Firebase Admin SDK and return its Auth instance.
 */
export function getFirebaseAuth() {
  if (admin.apps.length) return admin.auth()
  admin.initializeApp({ credential: buildCredential() })
  return admin.auth()
}

/**
 * Best-effort deletion of a user from Firebase Authentication.
 * Never throws — GDPR erasure of our own data must succeed even if the
 * Firebase account is already gone or credentials are unavailable.
 */
export async function deleteFirebaseUser(firebaseUid: string): Promise<void> {
  try {
    await getFirebaseAuth().deleteUser(firebaseUid)
  } catch (err) {
    console.warn(
      '[Firebase] Could not delete auth user (continuing):',
      err instanceof Error ? err.message : err,
    )
  }
}
