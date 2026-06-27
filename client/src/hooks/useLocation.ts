import { useEffect, useRef } from 'react'
import { useLocationStore } from '../store/locationStore'

interface UseLocationOptions {
  groupId?: string
  onUpdate?: (lat: number, lng: number) => void
}

export function useLocation({ groupId, onUpdate }: UseLocationOptions = {}) {
  const { setMyLocation } = useLocationStore()
  const watchId = useRef<number | null>(null)
  const lastEmit = useRef<number>(0)
  const DEBOUNCE_MS = 5000

  useEffect(() => {
    if (!groupId) return

    if (!navigator.geolocation) {
      console.warn('Geolocation API not supported')
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setMyLocation(pos.coords)
        const now = Date.now()
        if (now - lastEmit.current >= DEBOUNCE_MS) {
          lastEmit.current = now
          onUpdate?.(pos.coords.latitude, pos.coords.longitude)
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          console.warn('Location permission denied')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
    }
  }, [groupId, onUpdate, setMyLocation])
}
