import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AppUser {
  id: string
  firebase_uid: string
  name: string
  email: string
  avatar_url?: string
  phone?: string
  whatsapp?: string
  font_size: number
  sharing: boolean
}

interface AuthState {
  user: AppUser | null
  token: string | null
  isLoading: boolean
  setAuth: (user: AppUser, token: string) => void
  updateUser: (updates: Partial<AppUser>) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      setAuth: (user, token) => set({ user, token, isLoading: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      clearAuth: () => set({ user: null, token: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'lc-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)
