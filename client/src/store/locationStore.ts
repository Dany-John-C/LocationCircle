import { create } from 'zustand'

export interface MemberLocation {
  userId: string
  groupId?: string
  lat: number
  lng: number
  locality?: string
  accuracy?: number
  updatedAt: string
}

interface LocationState {
  locations: Record<string, MemberLocation>
  myLocation: GeolocationCoordinates | null
  updateLocation: (userId: string, loc: MemberLocation) => void
  setLocations: (locations: MemberLocation[]) => void
  setMyLocation: (coords: GeolocationCoordinates) => void
  clearLocations: () => void
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: {},
  myLocation: null,
  updateLocation: (userId, loc) =>
    set((state) => ({
      locations: { ...state.locations, [userId]: loc },
    })),
  setLocations: (locations) =>
    set(() => ({
      locations: locations.reduce<Record<string, MemberLocation>>((acc, loc) => {
        acc[loc.userId] = loc
        return acc
      }, {}),
    })),
  setMyLocation: (coords) => set({ myLocation: coords }),
  clearLocations: () => set({ locations: {}, myLocation: null }),
}))
