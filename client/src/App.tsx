import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { onAuthChange } from './lib/firebase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import Settings from './pages/Settings'
import GroupManage from './pages/GroupManage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  const location = useLocation()
  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  // Preserve where the user was headed (e.g. an invite /join/:token link)
  // so we can send them back there after they sign in.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}

export default function App() {
  const { user, setLoading } = useAuthStore()

  // Resolve the initial splash as soon as Firebase reports auth state (whether
  // a user is present or not). The app's real gate is the persisted JWT-backed
  // `user`, so once Firebase has reported we can stop showing the spinner.
  useEffect(() => {
    const unsub = onAuthChange(() => setLoading(false))
    // Safety net: never hang on the spinner if Firebase is slow/unreachable.
    const timer = setTimeout(() => setLoading(false), 3000)
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [setLoading])

  // Apply user font size globally
  useEffect(() => {
    if (user?.font_size) {
      document.documentElement.style.fontSize = `${user.font_size}px`
    }
  }, [user?.font_size])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/onboarding"
          element={<ProtectedRoute><Onboarding /></ProtectedRoute>}
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route
          path="/map"
          element={<ProtectedRoute><MapView /></ProtectedRoute>}
        />
        <Route
          path="/settings"
          element={<ProtectedRoute><Settings /></ProtectedRoute>}
        />
        <Route
          path="/group"
          element={<ProtectedRoute><GroupManage /></ProtectedRoute>}
        />
        {/* Invite join flow */}
        <Route
          path="/join/:token"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
