import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, User, Phone, MessageCircle, Type, Trash2, Camera, Bell } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useGroupStore } from '../store/groupStore'
import { useLocationStore } from '../store/locationStore'
import { signOut, uploadAvatar } from '../lib/firebase'
import api from '../lib/api'

export default function Settings() {
  const { user, updateUser, clearAuth } = useAuthStore()
  const { clearGroup } = useGroupStore()
  const { clearLocations } = useLocationStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(user?.sharing ?? true)
  const [fontSize, setFontSize] = useState(user?.font_size ?? 16)
  const [notifPrefs, setNotifPrefs] = useState({
    push: user?.notif_prefs?.push ?? true,
    whatsapp: user?.notif_prefs?.whatsapp ?? true,
    email: user?.notif_prefs?.email ?? false,
  })
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    whatsapp: user?.whatsapp || '',
  })

  // Profile photo upload (FR-AUTH-02)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Account deletion (FR-SET-05 / AC-12)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be smaller than 5 MB.')
      return
    }
    setPhotoError('')
    setUploadingPhoto(true)
    try {
      const url = await uploadAvatar(file, user.firebase_uid)
      const { data } = await api.put('/users/me', { avatar_url: url })
      updateUser(data)
    } catch {
      setPhotoError('Could not upload photo. Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete('/users/me')
      await signOut().catch(() => {})
      clearAuth()
      clearGroup()
      clearLocations()
      navigate('/login', { replace: true })
    } catch {
      setDeleteError('Could not delete your account. Please try again.')
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.put('/users/me', {
        ...form,
        sharing,
        font_size: fontSize,
        notif_prefs: notifPrefs,
      })
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
        {/* Avatar + photo upload */}
        <div className="card flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            aria-label="Change profile photo"
            className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0
                       focus-visible:ring-2 focus-visible:ring-accent group"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full bg-teal/30 flex items-center justify-center text-2xl font-bold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingPhoto ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" aria-hidden />
              )}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="sr-only"
            tabIndex={-1}
          />
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{user?.name}</p>
            <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="text-xs text-teal-light hover:text-teal mt-1 disabled:opacity-60"
            >
              {uploadingPhoto ? 'Uploading…' : 'Change photo'}
            </button>
            {photoError && <p className="text-xs text-red-400 mt-1" role="alert">{photoError}</p>}
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

        {/* Notification preferences (FR-SET-04) */}
        <section aria-labelledby="notif-heading" className="card space-y-3">
          <h2 id="notif-heading" className="font-semibold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal" aria-hidden /> Notifications
          </h2>
          {([
            { key: 'push', label: 'Push notifications', desc: 'Alerts in your browser / app' },
            { key: 'whatsapp', label: 'WhatsApp', desc: 'Updates via the WhatsApp bot' },
            { key: 'email', label: 'Email', desc: 'Summaries to your inbox' },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs[key]}
                aria-label={`Toggle ${label} notifications`}
                onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent flex-shrink-0
                  ${notifPrefs[key] ? 'bg-teal' : 'bg-navy-muted'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${notifPrefs[key] ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </section>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                     bg-white/5 border border-white/10 text-gray-300 font-semibold
                     hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent"
        >
          <LogOut className="w-4 h-4" aria-hidden /> Sign out
        </button>

        {/* Danger zone — delete account & all data (FR-SET-05) */}
        <section aria-labelledby="danger-heading" className="card border border-red-500/30 space-y-3">
          <h2 id="danger-heading" className="font-semibold text-red-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4" aria-hidden /> Delete account
          </h2>
          <p className="text-sm text-gray-400">
            Permanently delete your account and all associated location data. This
            cannot be undone (GDPR right to erasure).
          </p>
          <button
            type="button"
            onClick={() => { setShowDelete(true); setDeleteConfirm(''); setDeleteError('') }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                       bg-red-500/10 border border-red-500/30 text-red-400 font-semibold
                       hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <Trash2 className="w-4 h-4" aria-hidden /> Delete Account & Data
          </button>
        </section>
      </main>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-fade-in">
            <h3 id="delete-title" className="font-bold text-white text-lg mb-2">Delete your account?</h3>
            <p className="text-gray-400 text-sm mb-4">
              This permanently erases your profile, locations, and group memberships.
              Type <strong className="text-red-400">DELETE</strong> to confirm.
            </p>
            <label htmlFor="delete-confirm" className="sr-only">Type DELETE to confirm</label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="input-field mb-4"
              autoFocus
            />
            {deleteError && (
              <p className="text-sm text-red-400 mb-3" role="alert">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="btn-ghost flex-1 border border-white/10 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== 'DELETE'}
                className="flex-1 font-semibold py-3 rounded-xl bg-red-500/20 text-red-300
                           border border-red-500/30 hover:bg-red-500/30 transition-all
                           active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
