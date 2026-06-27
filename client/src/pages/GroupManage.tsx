import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, UserMinus, Crown, Clock, Link2, Copy, LogOut, RefreshCcw, Check, X, UserPlus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useGroupStore } from '../store/groupStore'
import type { Group, Member } from '../store/groupStore'
import RoleTag from '../components/RoleTag'
import api from '../lib/api'

interface JoinRequest {
  user_id: string
  name: string
  email: string
  avatar_url?: string
  created_at: string
}

// ── Reusable Confirmation Modal ────────────────────────────
interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-fade-in">
        <h3 id="confirm-title" className="font-bold text-white text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost flex-1 border border-white/10 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 font-semibold py-3 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                : 'btn-primary'
            }`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────
export default function GroupManage() {
  const { user } = useAuthStore()
  const { currentGroup, members, userGroups, setGroup, setMembers, setUserGroups, clearGroup } = useGroupStore()
  const navigate = useNavigate()

  const [groupName, setGroupName] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [tempHeadModal, setTempHeadModal] = useState<Member | null>(null)
  const [expiryHours, setExpiryHours] = useState(1)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Confirm modal state
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    confirmLabel: string
    variant: 'danger' | 'primary'
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const myRole = members.find((m) => m.id === user?.id)?.role
  const isHead = myRole === 'head'
  const activeTempHead = members.find((member) => member.role === 'temp_head')

  // ── Pending join requests (Head only) ──────────────────────
  const [requests, setRequests] = useState<JoinRequest[]>([])

  const loadRequests = useCallback(async () => {
    if (!currentGroup || !isHead) {
      setRequests([])
      return
    }
    try {
      const { data } = await api.get<JoinRequest[]>(`/groups/${currentGroup.id}/requests`)
      setRequests(data)
    } catch {
      // silent — keep last known list
    }
  }, [currentGroup, isHead])

  // Load on mount and poll so new requests appear without a manual refresh.
  useEffect(() => {
    void loadRequests()
    if (!currentGroup || !isHead) return
    const id = setInterval(() => void loadRequests(), 10000)
    return () => clearInterval(id)
  }, [loadRequests, currentGroup, isHead])

  const handleApproveRequest = async (req: JoinRequest) => {
    if (!currentGroup) return
    setError('')
    try {
      await api.post(`/groups/${currentGroup.id}/requests/${req.user_id}/approve`)
      setRequests((list) => list.filter((r) => r.user_id !== req.user_id))
      // Refresh the member list to include the newly admitted member
      type GroupDetails = Group & { members: Member[] }
      const { data } = await api.get<GroupDetails>(`/groups/${currentGroup.id}`)
      setMembers(data.members ?? [])
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not approve request.'
      setError(message)
    }
  }

  const handleDenyRequest = async (req: JoinRequest) => {
    if (!currentGroup) return
    setError('')
    try {
      await api.post(`/groups/${currentGroup.id}/requests/${req.user_id}/deny`)
      setRequests((list) => list.filter((r) => r.user_id !== req.user_id))
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not deny request.'
      setError(message)
    }
  }

  // Load user groups on mount
  const loadGroups = useCallback(async () => {
    try {
      const { data } = await api.get<Group[]>('/users/me/groups')
      setUserGroups(data)
    } catch {
      // silent
    }
  }, [setUserGroups])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  // Create new group
  const handleCreate = async () => {
    if (!groupName.trim()) return
    setCreating(true)
    setError('')
    try {
      const { data } = await api.post('/groups', { name: groupName })
      setGroup(data)
      setMembers([{ ...user!, role: 'head', joined_at: new Date().toISOString() } as Member])
      setGroupName('')
      await loadGroups()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not create group.'
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  // Switch to a different group
  const handleSwitchGroup = async (groupId: string) => {
    if (groupId === currentGroup?.id) return
    setLoading(true)
    setError('')
    try {
      type GroupDetails = Group & { members: Member[] }
      const { data } = await api.get<GroupDetails>(`/groups/${groupId}`)
      const { members: loadedMembers, ...group } = data
      setGroup(group)
      setMembers(loadedMembers ?? [])
      setInviteUrl('')
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not load group.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Generate invite link
  const handleGenerateInvite = async () => {
    if (!currentGroup) return
    setError('')
    try {
      const { data } = await api.post(`/groups/${currentGroup.id}/invite`, { expiryHours: 168 })
      setInviteUrl(data.invite_url)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not generate invite.'
      setError(message)
    }
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  // Remove member (with confirmation)
  const handleRemove = (member: Member) => {
    setConfirmAction({
      title: 'Remove Member',
      message: `Are you sure you want to remove ${member.name} from this group? They will need a new invite to rejoin.`,
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        if (!currentGroup) return
        await api.delete(`/groups/${currentGroup.id}/members/${member.id}`)
        setMembers(members.filter((m) => m.id !== member.id))
      },
    })
  }

  // Transfer head (with confirmation)
  const handleTransferHead = (member: Member) => {
    setConfirmAction({
      title: 'Transfer Head Role',
      message: `This will permanently transfer the Group Head role to ${member.name}. You will become a regular member. This action cannot be undone.`,
      confirmLabel: 'Transfer Head',
      variant: 'danger',
      onConfirm: async () => {
        if (!currentGroup) return
        await api.put(`/groups/${currentGroup.id}/head`, { userId: member.id })
        setGroup({ ...currentGroup, head_id: member.id })
        setMembers(members.map((m) => ({
          ...m,
          role: m.id === member.id ? 'head' : 'member',
        })))
      },
    })
  }

  // Leave group (with confirmation)
  const handleLeaveGroup = () => {
    setConfirmAction({
      title: 'Leave Group',
      message: `Are you sure you want to leave "${currentGroup?.name}"? You will need a new invite to rejoin.`,
      confirmLabel: 'Leave Group',
      variant: 'danger',
      onConfirm: async () => {
        if (!currentGroup) return
        await api.post(`/groups/${currentGroup.id}/leave`)
        clearGroup()
        const remaining = userGroups.filter((g) => g.id !== currentGroup.id)
        setUserGroups(remaining)
        if (remaining.length > 0) {
          await handleSwitchGroup(remaining[0].id)
        }
        navigate('/dashboard')
      },
    })
  }

  const handleDeleteCircle = () => {
    setConfirmAction({
      title: 'Delete Circle',
      message: `Permanently delete "${currentGroup?.name}" and ALL its data — members, locations, invites and requests — for everyone in the circle. This cannot be undone.`,
      confirmLabel: 'Delete Circle',
      variant: 'danger',
      onConfirm: async () => {
        if (!currentGroup) return
        await api.delete(`/groups/${currentGroup.id}`)
        const remaining = userGroups.filter((g) => g.id !== currentGroup.id)
        clearGroup()
        setUserGroups(remaining)
        navigate('/dashboard')
      },
    })
  }

  // Execute confirm action
  const executeConfirm = async () => {
    if (!confirmAction) return
    setConfirmLoading(true)
    setError('')
    try {
      await confirmAction.onConfirm()
      setConfirmAction(null)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Action failed.'
      setError(message)
      setConfirmAction(null)
    } finally {
      setConfirmLoading(false)
    }
  }

  // Assign temp head
  const handleAssignTempHead = async () => {
    if (!tempHeadModal || !currentGroup) return
    setLoading(true)
    setError('')
    try {
      await api.post(`/groups/${currentGroup.id}/temp-head`, {
        userId: tempHeadModal.id,
        expiryMinutes: expiryHours * 60,
      })
      setMembers(members.map((m) => ({
        ...m,
        role: m.id === tempHeadModal.id
          ? 'temp_head'
          : m.role === 'temp_head'
            ? 'member'
            : m.role,
      })))
      setTempHeadModal(null)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not assign temp head.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeTempHead = async () => {
    if (!currentGroup || !activeTempHead) return
    setLoading(true)
    setError('')
    try {
      await api.delete(`/groups/${currentGroup.id}/temp-head`)
      setMembers(members.map((m) => ({
        ...m,
        role: m.role === 'temp_head' ? 'member' : m.role,
      })))
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not revoke temp head.'
      setError(message)
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

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Group switcher (multi-group support) */}
        {userGroups.length > 1 && (
          <section aria-labelledby="switch-heading" className="card space-y-3">
            <h2 id="switch-heading" className="font-semibold text-white flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-teal" aria-hidden /> Switch Group
            </h2>
            <div className="flex flex-wrap gap-2">
              {userGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSwitchGroup(group.id)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    ${group.id === currentGroup?.id
                      ? 'bg-teal text-white'
                      : 'glass text-gray-300 hover:text-white hover:border-white/20'
                    }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </section>
        )}

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

            {/* Pending join requests (Head only) */}
            {isHead && (
              <section aria-labelledby="requests-heading" className="card space-y-3">
                <h2 id="requests-heading" className="font-semibold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-teal" aria-hidden /> Join Requests
                  {requests.length > 0 && (
                    <span className="ml-1 text-xs font-bold bg-accent/20 text-accent rounded-full px-2 py-0.5">
                      {requests.length}
                    </span>
                  )}
                </h2>
                {requests.length === 0 ? (
                  <p className="text-sm text-gray-400">No pending requests.</p>
                ) : (
                  <ul className="space-y-2" aria-live="polite">
                    {requests.map((req) => (
                      <li
                        key={req.user_id}
                        className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                      >
                        {req.avatar_url ? (
                          <img
                            src={req.avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {req.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{req.name}</p>
                          <p className="text-xs text-gray-400 truncate">{req.email}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleApproveRequest(req)}
                            aria-label={`Approve ${req.name}`}
                            className="p-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30
                                       hover:bg-green-500/25 transition-colors focus-visible:ring-2 focus-visible:ring-green-400"
                          >
                            <Check className="w-4 h-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDenyRequest(req)}
                            aria-label={`Deny ${req.name}`}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30
                                       hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
                          >
                            <X className="w-4 h-4" aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {isHead && activeTempHead && (
              <section aria-labelledby="temp-active-heading" className="card space-y-3 border border-accent/30">
                <h2 id="temp-active-heading" className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" aria-hidden /> Temporary Head
                </h2>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{activeTempHead.name}</p>
                    <p className="text-sm text-gray-400">Currently delegated</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRevokeTempHead}
                    disabled={loading}
                    className="px-3 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 text-sm font-semibold"
                  >
                    Revoke
                  </button>
                </div>
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
                      <p className="font-medium text-white truncate">
                        {member.name}
                        {member.id === user?.id && <span className="text-xs text-teal-light ml-1">(you)</span>}
                      </p>
                      <RoleTag role={member.role} size="sm" />
                    </div>
                    {isHead && member.id !== user?.id && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleTransferHead(member)}
                          aria-label={`Transfer permanent Head role to ${member.name}`}
                          className="p-2 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                        >
                          <Crown className="w-4 h-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTempHeadModal(member)}
                          aria-label={`Assign ${member.name} as Temporary Head`}
                          className="p-2 rounded-lg text-gray-400 hover:text-teal-light hover:bg-teal/10 transition-colors"
                        >
                          <Clock className="w-4 h-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(member)}
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

            {/* Leave group (non-Head only) */}
            {!isHead && (
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                           bg-red-500/10 border border-red-500/30 text-red-400 font-semibold
                           hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <LogOut className="w-4 h-4" aria-hidden /> Leave Group
              </button>
            )}

            {/* Delete circle (Head only) */}
            {isHead && (
              <section aria-labelledby="danger-circle-heading" className="card border border-red-500/30 space-y-3">
                <h2 id="danger-circle-heading" className="font-semibold text-red-400 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" aria-hidden /> Delete circle
                </h2>
                <p className="text-sm text-gray-400">
                  Permanently delete this circle and all its data for every member. This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteCircle}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                             bg-red-500/10 border border-red-500/30 text-red-400 font-semibold
                             hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <Trash2 className="w-4 h-4" aria-hidden /> Delete Circle
                </button>
              </section>
            )}
          </>
        )}

        {/* Temp Head assignment modal */}
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

        {/* Confirm action modal */}
        {confirmAction && (
          <ConfirmModal
            title={confirmAction.title}
            message={confirmAction.message}
            confirmLabel={confirmAction.confirmLabel}
            confirmVariant={confirmAction.variant}
            loading={confirmLoading}
            onConfirm={executeConfirm}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </main>
    </div>
  )
}
