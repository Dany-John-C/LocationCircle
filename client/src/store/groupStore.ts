import { create } from 'zustand'

export type MemberRole = 'head' | 'temp_head' | 'member'

export interface Member {
  id: string
  name: string
  email: string
  avatar_url?: string
  phone?: string
  whatsapp?: string
  role: MemberRole
  sharing: boolean
  joined_at: string
}

export interface Group {
  id: string
  name: string
  head_id: string
  invite_token?: string
  token_expiry?: string
  created_at: string
}

interface GroupState {
  currentGroup: Group | null
  members: Member[]
  userGroups: Group[]
  setGroup: (group: Group) => void
  setMembers: (members: Member[]) => void
  updateMember: (userId: string, updates: Partial<Member>) => void
  setUserGroups: (groups: Group[]) => void
  clearGroup: () => void
}

export const useGroupStore = create<GroupState>((set) => ({
  currentGroup: null,
  members: [],
  userGroups: [],
  setGroup: (group) => set({ currentGroup: group }),
  setMembers: (members) => set({ members }),
  updateMember: (userId, updates) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.id === userId ? { ...m, ...updates } : m,
      ),
    })),
  setUserGroups: (userGroups) => set({ userGroups }),
  clearGroup: () => set({ currentGroup: null, members: [] }),
}))
