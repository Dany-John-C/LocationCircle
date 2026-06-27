import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  Map,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import MemberCard from '../components/MemberCard'
import { useLocation } from '../hooks/useLocation'
import { useSocket } from '../hooks/useSocket'
import { useTTS } from '../hooks/useTTS'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import type { Group, Member } from '../store/groupStore'
import { useGroupStore } from '../store/groupStore'
import type { MemberLocation } from '../store/locationStore'
import { useLocationStore } from '../store/locationStore'

type GroupDetails = Group & { members: Member[] }

interface MemberSummary {
  member: Member
  location?: MemberLocation
  distanceKm?: number
  distance?: string
  carEta?: string
  transitEta?: string
}

const roleOrder: Record<Member['role'], number> = {
  head: 0,
  temp_head: 1,
  member: 2,
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}

function distanceBetweenKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const earthKm = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function formatDistance(km?: number) {
  if (km == null) return undefined
  if (km < 0.1) return 'nearby'
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function formatEta(km?: number, speedKmh = 30) {
  if (km == null) return undefined
  if (km < 0.1) return '<1 min'
  const minutes = Math.max(1, Math.round((km / speedKmh) * 60))
  return `${minutes} min`
}

function memberFromUser(user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>): Member {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    phone: user.phone,
    whatsapp: user.whatsapp,
    role: 'head',
    sharing: user.sharing,
    joined_at: new Date().toISOString(),
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { token: joinToken } = useParams<{ token: string }>()
  const { user, updateUser } = useAuthStore()
  const {
    currentGroup,
    members,
    userGroups,
    setGroup,
    setMembers,
    setUserGroups,
    updateMember,
    clearGroup,
  } = useGroupStore()
  const {
    locations,
    myLocation,
    setLocations,
    updateLocation,
    clearLocations,
  } = useLocationStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [realEta, setRealEta] = useState<
    Record<string, { distance: string; carEta: string; transitEta: string }>
  >({})
  const [pendingReqs, setPendingReqs] = useState<{ groupId: string; groupName: string }[]>([])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const { emitLocation } = useSocket(currentGroup?.id)
  const { speak, stop, isSpeaking, isSupported } = useTTS()

  const handleLocationUpdate = useCallback(
    (lat: number, lng: number) => {
      emitLocation(lat, lng)
      if (user && currentGroup) {
        updateLocation(user.id, {
          userId: user.id,
          groupId: currentGroup.id,
          lat,
          lng,
          locality: 'Current position',
          updatedAt: new Date().toISOString(),
        })
      }
    },
    [currentGroup, emitLocation, updateLocation, user],
  )

  useLocation({ groupId: currentGroup?.id, onUpdate: handleLocationUpdate })

  const loadGroup = useCallback(
    async (groupId: string) => {
      const [{ data: groupData }, { data: locationData }] = await Promise.all([
        api.get<GroupDetails>(`/groups/${groupId}`),
        api.get<MemberLocation[]>(`/locations/${groupId}`),
      ])

      const { members: loadedMembers, ...group } = groupData
      setGroup(group)
      setMembers(loadedMembers ?? [])
      setLocations(locationData ?? [])
    },
    [setGroup, setLocations, setMembers],
  )

  const bootstrap = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')

    try {
      if (joinToken) {
        try {
          // 202 → a pending join request was created (Head must approve)
          await api.post(`/groups/join/${joinToken}`)
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } }).response?.status
          if (status && status !== 409) {
            // 409 = already a member (fine); anything else = bad/expired link
            setError(
              (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
                'Invalid or expired invite link.',
            )
          } else if (!status) {
            throw err
          }
        } finally {
          navigate('/dashboard', { replace: true })
        }
      }

      const [{ data: groups }, { data: reqs }] = await Promise.all([
        api.get<Group[]>('/users/me/groups'),
        api.get<{ group_id: string; group_name: string }[]>('/users/me/requests'),
      ])
      setUserGroups(groups)
      setPendingReqs(reqs.map((r) => ({ groupId: r.group_id, groupName: r.group_name })))

      const groupToLoad = currentGroup?.id ?? groups[0]?.id

      if (groupToLoad) {
        await loadGroup(groupToLoad)
      } else {
        clearGroup()
        clearLocations()
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ??
        (err as { message?: string }).message ??
        'Could not load your group yet.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [
    clearGroup,
    clearLocations,
    currentGroup?.id,
    joinToken,
    loadGroup,
    navigate,
    setUserGroups,
    user,
  ])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // While a join request is pending, re-check membership so the dashboard
  // switches over automatically the moment the Head approves.
  const refreshMembership = useCallback(async () => {
    const [{ data: groups }, { data: reqs }] = await Promise.all([
      api.get<Group[]>('/users/me/groups'),
      api.get<{ group_id: string; group_name: string }[]>('/users/me/requests'),
    ])
    setUserGroups(groups)
    setPendingReqs(reqs.map((r) => ({ groupId: r.group_id, groupName: r.group_name })))
    if (groups.length) await loadGroup(groups[0].id)
  }, [loadGroup, setUserGroups])

  useEffect(() => {
    if (currentGroup || pendingReqs.length === 0) return
    const id = setInterval(() => void refreshMembership(), 8000)
    return () => clearInterval(id)
  }, [currentGroup, pendingReqs.length, refreshMembership])

  const viewerLocation = useMemo(() => {
    if (!user) return undefined
    const cached = locations[user.id]
    if (cached) return cached
    if (!myLocation || !currentGroup) return undefined
    return {
      userId: user.id,
      groupId: currentGroup.id,
      lat: myLocation.latitude,
      lng: myLocation.longitude,
      locality: 'Current position',
      accuracy: myLocation.accuracy,
      updatedAt: new Date().toISOString(),
    } satisfies MemberLocation
  }, [currentGroup, locations, myLocation, user])

  // Fetch real distance + ETA from Google Distance Matrix (FR-LOC-04).
  // Falls back silently to the straight-line estimate when the server has no
  // Maps key configured.
  const fetchRealEta = useCallback(
    async (origin: { lat: number; lng: number }) => {
      if (!currentGroup) return
      try {
        const { data } = await api.post<typeof realEta>(
          `/locations/${currentGroup.id}/eta`,
          { originLat: origin.lat, originLng: origin.lng },
        )
        setRealEta(data ?? {})
      } catch {
        // keep the estimate
      }
    },
    [currentGroup],
  )

  // Re-fetch only when the viewer moves ~100m, the group changes, or the
  // member count changes — avoids hammering the endpoint on every GPS tick.
  const originKey =
    viewerLocation != null
      ? `${viewerLocation.lat.toFixed(3)},${viewerLocation.lng.toFixed(3)}`
      : ''

  useEffect(() => {
    if (!originKey || !currentGroup) return
    const [lat, lng] = originKey.split(',').map(Number)
    void fetchRealEta({ lat, lng })
  }, [originKey, currentGroup, members.length, fetchRealEta])

  const memberSummaries = useMemo<MemberSummary[]>(() => {
    const origin = viewerLocation
      ? { lat: viewerLocation.lat, lng: viewerLocation.lng }
      : undefined

    return members
      .map((member) => {
        const location =
          member.id === user?.id
            ? locations[member.id] ?? viewerLocation
            : locations[member.id]

        const distanceKm =
          origin && location && member.id !== user?.id && member.sharing
            ? distanceBetweenKm(origin, { lat: location.lat, lng: location.lng })
            : undefined

        // Prefer Google Distance Matrix values; fall back to estimate
        const real = member.sharing ? realEta[member.id] : undefined

        return {
          member,
          location,
          distanceKm,
          distance: real?.distance ?? formatDistance(distanceKm),
          carEta: real?.carEta ?? formatEta(distanceKm, 30),
          transitEta: real?.transitEta ?? formatEta(distanceKm, 18),
        }
      })
      .sort((a, b) => {
        const roleDelta = roleOrder[a.member.role] - roleOrder[b.member.role]
        if (roleDelta !== 0) return roleDelta
        if (a.member.id === user?.id) return 1
        if (b.member.id === user?.id) return -1
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
      })
  }, [locations, members, realEta, user?.id, viewerLocation])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return memberSummaries
    return memberSummaries.filter(({ member, location }) =>
      [
        member.name,
        member.email,
        member.role.replace('_', ' '),
        location?.locality,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q)),
    )
  }, [memberSummaries, search])

  const handleReadAll = () => {
    const rows = filteredMembers.map(({ member, location, distance, carEta, transitEta }) => {
      const parts = [
        member.name,
        member.role === 'head' ? 'Group Head' : member.role === 'temp_head' ? 'Temporary Head' : 'Member',
        member.sharing ? location?.locality ?? 'location updating' : 'location paused',
      ]
      if (distance) parts.push(distance)
      if (carEta) parts.push(`${carEta} by car`)
      if (transitEta) parts.push(`${transitEta} by public transport`)
      return parts.join(', ')
    })

    speak(rows.length ? rows.join('. ') : 'No members to read.')
  }

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return
    setCreatingGroup(true)
    setError('')
    try {
      const { data: group } = await api.post<Group>('/groups', { name: newGroupName.trim() })
      setGroup(group)
      setMembers([memberFromUser(user)])
      setUserGroups([...userGroups, group])
      clearLocations()
      setNewGroupName('')
      setShowCreate(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ??
        'Could not create the group.'
      setError(message)
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleRefresh = async () => {
    if (!currentGroup) return
    setRefreshing(true)
    setError('')
    try {
      await loadGroup(currentGroup.id)
    } catch {
      setError('Could not refresh group data.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSwitchGroup = async (groupId: string) => {
    setSwitcherOpen(false)
    if (groupId === currentGroup?.id) return
    setLoading(true)
    setError('')
    try {
      clearLocations()
      await loadGroup(groupId)
    } catch {
      setError('Could not switch circle.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSharing = async () => {
    if (!user) return
    const nextSharing = !user.sharing
    updateUser({ sharing: nextSharing })
    updateMember(user.id, { sharing: nextSharing })

    try {
      const { data } = await api.put('/users/me', { sharing: nextSharing })
      updateUser(data)
      updateMember(user.id, { sharing: data.sharing })
    } catch {
      updateUser({ sharing: !nextSharing })
      updateMember(user.id, { sharing: !nextSharing })
      setError('Could not update location sharing.')
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading your circle...</p>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col page-enter">
      <a href="#member-list" className="skip-link">Skip to member list</a>

      <header className="glass-strong sticky top-0 z-30 px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          {/* Circle switcher — tap the name to see / switch circles */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
              className="w-full flex items-center gap-2 text-left p-1 rounded-xl hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-teal/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-light" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-gray-400">
                  {currentGroup ? `${members.length} members · switch circle` : 'Tap to choose a circle'}
                </span>
                <span className="flex items-center gap-1 font-bold text-white text-lg">
                  <span className="truncate">{currentGroup?.name ?? 'LocationCircle'}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${switcherOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </span>
              </span>
            </button>

            {switcherOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close circle menu"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setSwitcherOpen(false)}
                />
                <div role="menu" className="absolute left-0 top-full mt-2 z-40 w-72 max-w-[85vw] glass-strong rounded-2xl p-2 shadow-card">
                  <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-gray-400">Your circles</p>
                  {userGroups.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">No circles yet</p>
                  )}
                  {userGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="menuitem"
                      onClick={() => void handleSwitchGroup(g.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left hover:bg-white/10 transition-colors"
                    >
                      <span className="truncate text-white">{g.name}</span>
                      {g.id === currentGroup?.id && <Check className="w-4 h-4 text-teal-light flex-shrink-0" aria-hidden />}
                    </button>
                  ))}
                  <div className="border-t border-white/10 my-1" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setSwitcherOpen(false); setNewGroupName(''); setShowCreate(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-teal-light hover:bg-teal/10 transition-colors"
                  >
                    <Plus className="w-4 h-4" aria-hidden /> Create new circle
                  </button>
                  {currentGroup && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setSwitcherOpen(false); navigate('/group') }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-gray-300 hover:bg-white/10 transition-colors"
                    >
                      <Settings className="w-4 h-4" aria-hidden /> Manage current circle
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Always-visible create button */}
          <button
            type="button"
            onClick={() => { setNewGroupName(''); setShowCreate(true) }}
            aria-label="Create new circle"
            className="flex-shrink-0 p-2 rounded-xl text-teal-light hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="w-5 h-5" aria-hidden />
          </button>

          {currentGroup && (
            <button
              type="button"
              onClick={handleToggleSharing}
              className="btn-ghost px-3 py-2 flex items-center gap-2 flex-shrink-0"
              aria-pressed={!user?.sharing}
            >
              {user?.sharing ? (
                <Pause className="w-4 h-4" aria-hidden />
              ) : (
                <Play className="w-4 h-4" aria-hidden />
              )}
              <span className="text-sm hidden sm:inline">{user?.sharing ? 'Pause' : 'Resume'}</span>
            </button>
          )}
        </div>

        {currentGroup && (
          <div className="mt-3 flex gap-2">
            <label className="relative flex-1" htmlFor="member-search">
              <span className="sr-only">Search members</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
              <input
                id="member-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members..."
                className="input-field pl-10"
              />
            </label>
            {isSupported && (
              <button
                type="button"
                onClick={isSpeaking ? stop : handleReadAll}
                className="btn-primary px-3 flex items-center gap-2"
                aria-label={isSpeaking ? 'Stop reading member list' : 'Read member list aloud'}
                aria-pressed={isSpeaking}
              >
                {isSpeaking ? (
                  <VolumeX className="w-4 h-4" aria-hidden />
                ) : (
                  <Volume2 className="w-4 h-4" aria-hidden />
                )}
                <span className="hidden sm:inline">{isSpeaking ? 'Stop' : 'Read'}</span>
              </button>
            )}
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1 px-4 py-4 pb-24">
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm"
          >
            {error}
          </div>
        )}

        {!currentGroup && pendingReqs.length > 0 ? (
          <section
            className="card max-w-md mx-auto mt-12 space-y-3 text-center"
            aria-live="polite"
            aria-label="Join request pending"
          >
            <div className="text-4xl" aria-hidden>⏳</div>
            <h2 className="text-xl font-bold text-white">Waiting for approval</h2>
            <p className="text-sm text-gray-400">
              Your request to join{' '}
              <strong className="text-white">{pendingReqs[0].groupName}</strong> has been sent.
              The group Head needs to approve it — this page updates automatically.
            </p>
            <button
              type="button"
              onClick={() => void refreshMembership()}
              className="btn-ghost text-sm mx-auto"
            >
              Check now
            </button>
          </section>
        ) : !currentGroup ? (
          <section className="card max-w-md mx-auto mt-12 space-y-4" aria-labelledby="create-circle-title">
            <div>
              <h2 id="create-circle-title" className="text-xl font-bold text-white">
                Create your first circle
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Start a private group, then invite the people you trust.
              </p>
            </div>
            <label htmlFor="new-group-name" className="block text-sm text-gray-300">
              Group name
            </label>
            <input
              id="new-group-name"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              className="input-field"
              placeholder="Family Circle"
            />
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={creatingGroup || !newGroupName.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" aria-hidden />
              {creatingGroup ? 'Creating...' : 'Create Group'}
            </button>
          </section>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-400" aria-live="polite">
                {filteredMembers.length} of {members.length} members shown
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-ghost text-sm"
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <ul id="member-list" className="space-y-3" aria-label="Group members">
              {filteredMembers.map(({ member, location, distance, carEta, transitEta }) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  location={location}
                  distance={distance}
                  carEta={carEta}
                  transitEta={transitEta}
                  isCurrentUser={member.id === user?.id}
                  onClick={() => navigate(`/map?focus=${member.id}`)}
                />
              ))}
            </ul>

            {!filteredMembers.length && (
              <p className="text-center text-gray-400 mt-10" role="status">
                No members match your search.
              </p>
            )}
          </>
        )}
      </main>

      {/* Create new circle modal — reachable anytime */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-circle-modal-title"
        >
          <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-fade-in space-y-4">
            <div>
              <h3 id="create-circle-modal-title" className="font-bold text-white text-lg">Create a new circle</h3>
              <p className="text-sm text-gray-400 mt-1">You'll become its Group Head and can invite others.</p>
            </div>
            <label htmlFor="modal-group-name" className="sr-only">Circle name</label>
            <input
              id="modal-group-name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Family Circle"
              className="input-field"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && newGroupName.trim()) void handleCreateGroup() }}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={creatingGroup}
                className="btn-ghost flex-1 border border-white/10 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={creatingGroup || !newGroupName.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" aria-hidden />
                {creatingGroup ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-white/8 px-4" aria-label="Navigation">
        <div className="flex justify-around py-2">
          <button type="button" className="nav-item active" aria-current="page" aria-label="Dashboard">
            <Users className="w-5 h-5" aria-hidden />
            <span className="text-xs">Group</span>
          </button>
          <button type="button" onClick={() => navigate('/map')} className="nav-item" aria-label="Map view">
            <Map className="w-5 h-5" aria-hidden />
            <span className="text-xs">Map</span>
          </button>
          <button type="button" onClick={() => navigate('/settings')} className="nav-item" aria-label="Settings">
            <Settings className="w-5 h-5" aria-hidden />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
