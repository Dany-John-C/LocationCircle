import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signInWithGoogle } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')
    try {
      const idToken = await signInWithGoogle()
      const { data } = await api.post('/auth/google', { idToken })
      setAuth(data.user, data.token)
      // Return to an invite link if that's where they came from; otherwise
      // onboard new users, or go to the dashboard.
      if (from && from.startsWith('/join/')) {
        navigate(from, { replace: true })
      } else {
        navigate(data.user.phone ? '/dashboard' : '/onboarding')
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 page-enter"
      aria-label="LocationCircle login page"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center mb-4 shadow-glow-teal"
            aria-hidden="true"
          >
            <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
              <circle cx="24" cy="20" r="8" stroke="white" strokeWidth="2.5" />
              <path d="M24 28c-8 0-14 4-14 9v1h28v-1c0-5-6-9-14-9z" fill="white" fillOpacity="0.3" />
              <circle cx="24" cy="20" r="3" fill="white" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">LocationCircle</h1>
          <p className="text-gray-400 text-sm mt-2 text-center leading-relaxed">
            Share your location privately with<br />people you trust
          </p>
        </div>

        {/* Sign in card */}
        <div className="glass rounded-3xl p-8">
          <h2 className="text-lg font-semibold text-white mb-2 text-center">
            Welcome back
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">
            Sign in with your Google account to continue
          </p>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center"
            >
              {error}
            </div>
          )}

          <button
            id="google-signin-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            aria-label="Sign in with Google"
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold
                       py-3 px-6 rounded-xl hover:bg-gray-50 active:scale-95 transition-all duration-200
                       focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                       focus-visible:ring-offset-navy disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4 leading-relaxed">
            By signing in, you agree to share your location only with
            groups you explicitly join.
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: '🔒', label: 'Private groups' },
            { icon: '📍', label: 'Live location' },
            { icon: '♿', label: 'Accessible' },
          ].map(({ icon, label }) => (
            <div key={label} className="glass rounded-2xl p-3">
              <div className="text-xl mb-1" aria-hidden="true">{icon}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
