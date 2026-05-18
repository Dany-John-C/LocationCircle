import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, UserMinus, Crown, Clock, Link2, Copy } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useGroupStore } from '../store/groupStore'
import type { Member } from '../store/groupStore'
import RoleTag from '../components/RoleTag'
import api from '../lib/api'

export default function GroupManage() {
  const { user } = useAuthStore()
  const { currentGroup, members, setGroup, setMembers } = useGroupStore()
  const navigate = useNavigate()

  const [groupName, setGroupName] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [tempHeadModal, setTempHeadModal] = useState<Member | null>(null)
  const [expiryHours, setExpiryHours] = useState(1)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  const myRole = members.find((m) => m.id === user?.id)?.role
  const isHead = myRole === 'head' || myRole === 'temp_head'

  // Create new group
  const handleCreate = async () => {
    if (!groupName.trim()) return
    setCreating(true)
    try {
      const { data } = await api.post('/groups', { name: groupName })
      setGroup(data)
      setMembers([{ ...user!, role: 'head', joined_at: new Date().toISOString() } as Member])
      setGroupName('')
    } finally {
      setCreating(false)
    }
  }

  // Generate invite link
  const handleGenerateInvite = async () => {
    if (!currentGroup) return
    const { data } = await api.post(`/groups/${currentGroup.id}/invite`, { expiryHours: 168 })
    setInviteUrl(data.invite_url)
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  // Remove member
  const handleRemove = async (memberId: string) => {
    if (!currentGroup) return
    if (!confirm('Remove this member from the group?')) return
    await api.delete(`/groups/${currentGroup.id}/members/${memberId}`)
    setMembers(members.filter((m) => m.id !== memberId))
  }

  // Assign temp head
  const handleAssignTempHead = async () => {
    if (!tempHeadModal || !currentGroup) return
    setLoading(true)
    try {
      await api.post(`/groups/${currentGroup.id}/temp-head`, {
        userId: tempHeadModal.id,
        expiryMinutes: expiryHours * 60,
      })
      setMembers(members.map((m) => ({
        ...m,
        role: m.id === tempHeadModal.id ? 'temp_head' : m.role,
      })))
      setTempHeadModal(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col page-enter">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-30 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" aria-hidden />
        </button>
        <h1 className="font-bold text-white text-lg flex-1">Group Management</h1>
      </header>

      <main id="main-content" className="flex-1 px-4 py-4 space-y-4 pb-8">

        {/* Create group */}
        {!currentGroup && (
          <section aria-labelledby="create-heading" className="card space-y-3">
            <h2 id="create-heading" className="font-semibold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal" aria-hidden /> Create a Group
            </h2>
            <input
              id="group-name-input"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Family)"
              className="input-field"
            />
            <button type="button" onClick={handleCreate} disabled={creating || !groupName.trim()} className="btn-primary w-full">
              {creating ? 'Creating…' : 'Create Group'}
            </button>
          </section>
        )}

        {/* Current group info */}
        {currentGroup && (
          <>
            <div className="card">
              <h2 className="font-semibold text-white mb-1">{currentGroup.name}</h2>
              <p className="text-sm text-gray-400">{members.length} members</p>
            </div>

            {/* Invite link (head only) */}
            {isHead && (
              <section aria-labelledby="invite-heading" className="card space-y-3">
                <h2 id="invite-heading" className="font-semibold text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-teal" aria-hidden /> Invite Members
                </h2>
                {!inviteUrl ? (
                  <button type="button" onClick={handleGenerateInvite} className="btn-primary w-full">
                    Generate Invite Link
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      aria-label="Invite URL"
                      className="input-field flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      aria-label="Copy invite link"
                      className="btn-primary px-3 flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                )}
                {inviteCopied && <p className="text-sm text-teal-light" role="status">✓ Copied to clipboard!</p>}
              </section>
            )}

            {/* Members list */}
            <section aria-labelledby="members-heading" className="card space-y-3">
              <h2 id="members-heading" className="font-semibold text-white">Members</h2>
              <ul className="space-y-2">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{member.name}</p>
                      <RoleTag role={member.role} size="sm" />
                    </div>
                    {isHead && member.id !== user?.id && (
                      <div className="flex gap-1">
                        {myRole === 'head' && (
                          <button
                            type="button"
                            onClick={() => setTempHeadModal(member)}
                            aria-label={`Assign ${member.name} as Temporary Head`}
                            className="p-2 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            <Crown className="w-4 h-4" aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(member.id)}
                          aria-label={`Remove ${member.name} from group`}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <UserMinus className="w-4 h-4" aria-hidden />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* Temp Head modal */}
        {tempHeadModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="temp-head-title"
          >
            <div className="glass-strong rounded-3xl p-6 w-full max-w-sm">
              <h3 id="temp-head-title" className="font-bold text-white text-lg mb-1">
                Assign Temporary Head
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                <strong className="text-white">{tempHeadModal.name}</strong> will manage the group until the time expires.
              </p>
              <label htmlFor="expiry-select" className="block text-sm text-gray-400 mb-2">
                <Clock className="inline w-3 h-3 mr-1" aria-hidden /> Duration
              </label>
              <select
                id="expiry-select"
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                className="input-field mb-4"
              >
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>2 days</option>
              </select>
              <div className="flex gap-3">
                <button type="button" onClick={() => setTempHeadModal(null)} className="btn-ghost flex-1 border border-white/10 rounded-xl">Cancel</button>
                <button type="button" onClick={handleAssignTempHead} disabled={loading} className="btn-accent flex-1">
                  {loading ? 'Assigning…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
