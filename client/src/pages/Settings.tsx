import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, User, Phone, MessageCircle, Type } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useGroupStore } from '../store/groupStore'
import { signOut } from '../lib/firebase'
import api from '../lib/api'

export default function Settings() {
  const { user, updateUser, clearAuth } = useAuthStore()
  const { clearGroup } = useGroupStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(user?.sharing ?? true)
  const [fontSize, setFontSize] = useState(user?.font_size ?? 16)
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    whatsapp: user?.whatsapp || '',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.put('/users/me', { ...form, sharing, font_size: fontSize })
      updateUser(data)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    clearAuth()
    clearGroup()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh flex flex-col page-enter">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-30 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" aria-hidden />
        </button>
        <h1 className="font-bold text-white text-lg flex-1">Settings</h1>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary py-2 px-4 text-sm">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <main id="main-content" className="flex-1 px-4 py-4 space-y-4 pb-8">
        {/* Avatar */}
        <div className="card flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-teal/30 flex items-center justify-center text-2xl font-bold text-white">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{user?.name}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
        </div>

        {/* Profile */}
        <section aria-labelledby="profile-heading" className="card space-y-4">
          <h2 id="profile-heading" className="font-semibold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-teal" aria-hidden /> Profile
          </h2>
          <div>
            <label htmlFor="settings-name" className="block text-sm text-gray-400 mb-1">Name</label>
            <input id="settings-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label htmlFor="settings-phone" className="block text-sm text-gray-400 mb-1">
              <Phone className="inline w-3 h-3 mr-1" aria-hidden />Phone
            </label>
            <input id="settings-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+91 98765 43210" />
          </div>
          <div>
            <label htmlFor="settings-wa" className="block text-sm text-gray-400 mb-1">
              <MessageCircle className="inline w-3 h-3 mr-1" aria-hidden />WhatsApp
            </label>
            <input id="settings-wa" type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input-field" placeholder="+91 98765 43210" />
          </div>
        </section>

        {/* Location sharing toggle */}
        <section aria-labelledby="sharing-heading" className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="sharing-heading" className="font-semibold text-white">Location sharing</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {sharing ? 'Your group can see your location' : 'Your location is hidden'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sharing}
              aria-label="Toggle location sharing"
              onClick={() => setSharing(!sharing)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent
                ${sharing ? 'bg-teal' : 'bg-navy-muted'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${sharing ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </section>

        {/* Font size */}
        <section aria-labelledby="font-heading" className="card">
          <h2 id="font-heading" className="font-semibold text-white flex items-center gap-2 mb-3">
            <Type className="w-4 h-4 text-teal" aria-hidden /> Text size
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">A</span>
            <input
              type="range" min={12} max={28} step={2} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              aria-label={`Font size: ${fontSize}px`}
              className="flex-1 accent-teal"
            />
            <span className="text-lg text-white font-bold">A</span>
          </div>
          <p className="text-sm text-gray-400 mt-2" style={{ fontSize: `${fontSize}px` }}>
            Sample text at {fontSize}px
          </p>
        </section>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                     bg-red-500/10 border border-red-500/30 text-red-400 font-semibold
                     hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <LogOut className="w-4 h-4" aria-hidden /> Sign out
        </button>
      </main>
    </div>
  )
}
