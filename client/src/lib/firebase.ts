import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

/**
 * Upload a profile photo to Firebase Storage and return its public URL.
 * Stored at avatars/{uid}/{timestamp}.{ext} so the latest upload wins.
 */
export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const storageRef = ref(storage, `avatars/${uid}/${Date.now()}.${ext}`)
  // Fail fast instead of hanging if Storage isn't enabled / rules block writes.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Upload timed out — check that Firebase Storage is enabled and its rules allow writes.')),
      20000,
    ),
  )
  await Promise.race([uploadBytes(storageRef, file, { contentType: file.type }), timeout])
  return getDownloadURL(storageRef)
}

export async function signInWithGoogle(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider)
  const token = await result.user.getIdToken()
  return token
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export type { User }
