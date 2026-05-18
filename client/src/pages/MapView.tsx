import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader } from '@googlemaps/js-api-loader'
import { ChevronDown, Users, Settings } from 'lucide-react'
import { useGroupStore } from '../store/groupStore'
import { useLocationStore } from '../store/locationStore'
import { useAuthStore } from '../store/authStore'
import MapPin from '../components/MapPin'

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const { members, currentGroup } = useGroupStore()
  const { locations } = useLocationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!mapRef.current) return
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
    })
    loader.load().then(() => {
      const map = new google.maps.Map(mapRef.current!, {
        zoom: 13,
        center: { lat: 10.8505, lng: 76.2711 },
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#1A2E4A' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D7377' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#243d5f' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0A1628' }] },
        ],
        disableDefaultUI: false,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
      })
      setMapInstance(map)

      // Fit bounds to member locations
      const locs = Object.values(locations)
      if (locs.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        locs.forEach((l) => bounds.extend({ lat: l.lat, lng: l.lng }))
        map.fitBounds(bounds, { padding: 64 })
      }
    })
  }, [])

  return (
    <div className="min-h-dvh flex flex-col relative">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        aria-label="Back to dashboard"
        className="absolute top-4 left-4 z-30 glass rounded-2xl p-3 shadow-card
                   focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronDown className="w-5 h-5 text-white rotate-90" aria-hidden />
      </button>

      {/* Group name pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 glass rounded-2xl px-4 py-2">
        <p className="text-white font-semibold text-sm">{currentGroup?.name ?? 'Group Map'}</p>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="flex-1 w-full"
        aria-label="Group location map"
        role="img"
      />

      {/* Member pins */}
      {mapInstance && members.map((member) => {
        const loc = locations[member.id]
        if (!loc) return null
        return (
          <MapPin
            key={member.id}
            map={mapInstance}
            member={member}
            lat={loc.lat}
            lng={loc.lng}
            onClick={() => setSelectedMember(member.id)}
          />
        )
      })}

      {/* Bottom nav */}
      <nav className="absolute bottom-0 left-0 right-0 glass-strong border-t border-white/8 px-4 pb-safe" aria-label="Navigation">
        <div className="flex justify-around py-2">
          <button type="button" onClick={() => navigate('/dashboard')} className="nav-item" aria-label="Dashboard">
            <Users className="w-5 h-5" aria-hidden /><span className="text-xs">Group</span>
          </button>
          <button type="button" className="nav-item active" aria-current="page" aria-label="Map view">
            <span className="text-xl" aria-hidden>🗺</span><span className="text-xs">Map</span>
          </button>
          <button type="button" onClick={() => navigate('/settings')} className="nav-item" aria-label="Settings">
            <Settings className="w-5 h-5" aria-hidden /><span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
