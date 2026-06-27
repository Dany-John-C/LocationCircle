import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronDown, LocateFixed, Users, Settings, Layers } from 'lucide-react'
import { useGroupStore } from '../store/groupStore'
import { useLocationStore } from '../store/locationStore'
import { useAuthStore } from '../store/authStore'
import MapPin from '../components/MapPin'

const STREET_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<L.Map | null>(null)
  const streetRef = useRef<L.TileLayer | null>(null)
  const satRef = useRef<L.TileLayer | null>(null)
  const didFitRef = useRef(false)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street')
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const { members, currentGroup } = useGroupStore()
  const { locations } = useLocationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('focus')
  const selectedMemberDetails = members.find((member) => member.id === selectedMember)

  // ── Initialise the Leaflet map once (no API key / billing required) ──
  useEffect(() => {
    if (!mapRef.current || mapObjRef.current) return

    const map = L.map(mapRef.current, {
      center: [10.8505, 76.2711],
      zoom: 13,
      zoomControl: false,
    })

    // Dark street basemap (CARTO over OSM) + satellite basemap (Esri) — both
    // keyless. Street is shown by default; the toggle swaps between them.
    const street = L.tileLayer(STREET_TILES, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    })
    const sat = L.tileLayer(SATELLITE_TILES, {
      attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    })
    street.addTo(map)
    streetRef.current = street
    satRef.current = sat

    // Accessible +/- zoom buttons, bottom-right (FR-MAP-04)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    mapObjRef.current = map
    setMapInstance(map)

    // Recompute size once the flex layout has settled
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapObjRef.current = null
      streetRef.current = null
      satRef.current = null
      didFitRef.current = false
    }
  }, [])

  // ── Satellite / street toggle (FR-MAP-04) ──
  useEffect(() => {
    const map = mapObjRef.current
    const street = streetRef.current
    const sat = satRef.current
    if (!map || !street || !sat) return
    if (mapType === 'satellite') {
      if (map.hasLayer(street)) map.removeLayer(street)
      if (!map.hasLayer(sat)) sat.addTo(map)
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat)
      if (!map.hasLayer(street)) street.addTo(map)
    }
  }, [mapType])

  // ── Center on the tapped member (FR-MAP-01) or fit all members ──
  useEffect(() => {
    const map = mapObjRef.current
    if (!map || didFitRef.current) return
    const locs = Object.values(locations)
    if (locs.length === 0) return

    if (focusId && locations[focusId]) {
      const f = locations[focusId]
      map.setView([f.lat, f.lng], 15)
      setSelectedMember(focusId)
    } else {
      const bounds = L.latLngBounds(locs.map((l) => [l.lat, l.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [64, 64], maxZoom: 16 })
    }
    didFitRef.current = true
  }, [mapInstance, locations, focusId])

  const handleLocateMe = () => {
    const map = mapObjRef.current
    if (!map || !user) return
    const loc = locations[user.id]
    if (!loc) return
    map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 15))
  }

  // Hidden, screen-reader-only text summary of marker positions (FR-MAP-05)
  const positionsSummary = useMemo(() => {
    const lines = members
      .map((m) => {
        const loc = locations[m.id]
        if (!loc) return null
        const role = m.role === 'head' ? ', Group Head' : m.role === 'temp_head' ? ', Temporary Head' : ''
        const who = m.id === user?.id ? `${m.name} (you)` : m.name
        return `${who} is in ${loc.locality ?? 'an unknown area'}${role}.`
      })
      .filter(Boolean)
    return lines.length ? lines.join(' ') : 'No member locations available yet.'
  }, [members, locations, user?.id])

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

      {/* Satellite / street toggle */}
      <button
        type="button"
        onClick={() => setMapType((t) => (t === 'street' ? 'satellite' : 'street'))}
        aria-label={`Switch to ${mapType === 'street' ? 'satellite' : 'street'} view`}
        className="absolute top-4 right-4 z-30 glass rounded-2xl px-3 py-2 flex items-center gap-2
                   text-white text-sm font-medium shadow-card focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Layers className="w-4 h-4" aria-hidden />
        <span className="hidden sm:inline">{mapType === 'street' ? 'Satellite' : 'Street'}</span>
      </button>

      {/* Map — own stacking context (z-0) so overlays sit above Leaflet's controls */}
      <div
        ref={mapRef}
        className="flex-1 w-full relative z-0"
        aria-label="Group location map"
        role="img"
      />

      {/* Screen-reader-only live summary of where everyone is (FR-MAP-05) */}
      <div className="sr-only" aria-live="polite" role="status">
        {positionsSummary}
      </div>

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
            isSelf={member.id === user?.id}
            onClick={() => setSelectedMember(member.id)}
          />
        )
      })}

      <button
        type="button"
        onClick={handleLocateMe}
        aria-label="Center map on my location"
        className="absolute bottom-24 left-4 z-30 glass rounded-2xl p-3 shadow-card
                   focus-visible:ring-2 focus-visible:ring-accent"
      >
        <LocateFixed className="w-5 h-5 text-white" aria-hidden />
      </button>

      {selectedMemberDetails && (
        <section
          className="absolute left-4 right-4 bottom-24 z-30 glass-strong rounded-2xl p-4"
          aria-live="polite"
          aria-label={`${selectedMemberDetails.name} selected on map`}
        >
          <p className="font-semibold text-white">
            {selectedMemberDetails.name}
            {selectedMemberDetails.id === user?.id && (
              <span className="text-sm text-teal-light font-medium ml-1">(you)</span>
            )}
          </p>
          <p className="text-sm text-gray-400">
            {locations[selectedMemberDetails.id]?.locality ?? 'Location updating'}
          </p>
        </section>
      )}

      {/* Bottom nav */}
      <nav className="absolute bottom-0 left-0 right-0 z-30 glass-strong border-t border-white/8 px-4 pb-safe" aria-label="Navigation">
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
