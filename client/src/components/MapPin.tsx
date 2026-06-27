import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import type { Member } from '../store/groupStore'

interface MapPinProps {
  map: L.Map
  member: Member
  lat: number
  lng: number
  isSelf?: boolean
  onClick?: () => void
}

// Build a circular profile-photo marker. The Head gets a larger gold ring,
// the Temp Head a teal ring, everyone else a white ring. The viewing user's
// own pin gets a "You" label and a pulsing teal ring so it stands out
// (FR-MAP-03).
function buildIcon(member: Member, isSelf: boolean): L.DivIcon {
  const isHead = member.role === 'head'
  const isTempHead = member.role === 'temp_head'
  const borderColor = isHead ? '#F0A500' : isTempHead ? '#00a884' : '#ffffff'
  const size = isHead ? 48 : 40
  const label = isSelf ? 'You' : isHead ? 'Head' : ''
  const labelColor = isSelf ? '#06cf9c' : '#F0A500'
  const labelH = label ? 16 : 0
  const totalH = labelH + size + 8 // label + avatar + pointer
  const avatar = member.avatar_url
    ? `<img src="${member.avatar_url}" style="width:100%;height:100%;object-fit:cover" alt="" />`
    : member.name.charAt(0).toUpperCase()

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;">
      ${label ? `<span style="font-size:11px;font-weight:700;color:${labelColor};margin-bottom:2px;text-shadow:0 1px 2px rgba(0,0,0,.7)">${label}</span>` : ''}
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${isSelf ? '<span class="lc-pulse"></span>' : ''}
        <div style="
          position:relative;width:${size}px;height:${size}px;border-radius:50%;
          border:3px solid ${isSelf ? '#06cf9c' : borderColor};overflow:hidden;
          box-shadow:0 2px 12px rgba(0,0,0,0.5);background:#1A2E4A;
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:700;font-size:18px;">
          ${avatar}
        </div>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${isSelf ? '#06cf9c' : borderColor};margin-top:-1px;"></div>
    </div>`

  return L.divIcon({
    html,
    className: 'lc-pin',
    iconSize: [size, totalH],
    iconAnchor: [size / 2, totalH], // pointer tip sits on the coordinate
  })
}

export default function MapPin({ map, member, lat, lng, isSelf = false, onClick }: MapPinProps) {
  const markerRef = useRef<L.Marker | null>(null)
  // Keep the latest onClick without forcing the marker to be recreated.
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  // Create / replace the marker when the map or member (role, avatar, self) changes.
  useEffect(() => {
    const marker = L.marker([lat, lng], {
      icon: buildIcon(member, isSelf),
      title: isSelf ? `${member.name} (you)` : member.name,
      alt: `${member.name}'s location`,
      keyboard: true,
    })
    marker.on('click', () => onClickRef.current?.())
    marker.addTo(map)
    markerRef.current = marker
    return () => {
      marker.remove()
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, member, isSelf])

  // Move the existing marker on location updates (no flicker).
  useEffect(() => {
    markerRef.current?.setLatLng([lat, lng])
  }, [lat, lng])

  return null
}
