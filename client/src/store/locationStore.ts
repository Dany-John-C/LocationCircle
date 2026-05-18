import { create } from 'zustand'

export interface MemberLocation {
  userId: string
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
  setMyLocation: (coords) => set({ myLocation: coords }),
  clearLocations: () => set({ locations: {}, myLocation: null }),
}))
