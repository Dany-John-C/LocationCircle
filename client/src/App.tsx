import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { user, setLoading } = useAuthStore()

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthChange((firebaseUser) => {
      if (!firebaseUser) setLoading(false)
      // If firebaseUser exists but no JWT, the persist store handles it
    })
    return unsub
  }, [])

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
