import { useEffect, useRef } from 'react'
import type { Member } from '../store/groupStore'

interface MapPinProps {
  map: google.maps.Map
  member: Member
  lat: number
  lng: number
  onClick?: () => void
}

// Custom Google Maps OverlayView pin with member avatar
class MemberPinOverlay extends google.maps.OverlayView {
  private div: HTMLDivElement | null = null
  private member: Member
  private lat: number
  private lng: number
  private onClick?: () => void

  constructor(member: Member, lat: number, lng: number, onClick?: () => void) {
    super()
    this.member = member
    this.lat = lat
    this.lng = lng
    this.onClick = onClick
  }

  onAdd() {
    this.div = document.createElement('div')
    this.div.style.position = 'absolute'
    this.div.style.cursor = 'pointer'
    this.div.setAttribute('role', 'button')
    this.div.setAttribute('aria-label', `${this.member.name}'s location`)
    this.div.tabIndex = 0

    const isHead = this.member.role === 'head'
    const isTempHead = this.member.role === 'temp_head'
    const borderColor = isHead ? '#F0A500' : isTempHead ? '#0D7377' : '#ffffff'
    const size = isHead ? '48px' : '40px'

    this.div.innerHTML = `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        ${isHead ? '<span style="font-size:16px;margin-bottom:2px">★</span>' : ''}
        <div style="
          width: ${size};
          height: ${size};
          border-radius: 50%;
          border: 3px solid ${borderColor};
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4);
          background: #1A2E4A;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 18px;
        ">
          ${this.member.avatar_url
            ? `<img src="${this.member.avatar_url}" style="width:100%;height:100%;object-fit:cover" alt="${this.member.name}" />`
            : this.member.name.charAt(0).toUpperCase()
          }
        </div>
        <div style="
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid ${borderColor};
          margin-top: -1px;
        "></div>
      </div>
    `

    this.div.addEventListener('click', () => this.onClick?.())
    this.div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onClick?.()
    })

    const panes = this.getPanes()!
    panes.overlayMouseTarget.appendChild(this.div)
  }

  draw() {
    if (!this.div) return
    const overlayProj = this.getProjection()
    const pos = overlayProj.fromLatLngToDivPixel(
      new google.maps.LatLng(this.lat, this.lng),
    )
    if (pos) {
      this.div.style.left = `${pos.x}px`
      this.div.style.top = `${pos.y}px`
    }
  }

  onRemove() {
    this.div?.parentNode?.removeChild(this.div)
    this.div = null
  }

  updatePosition(lat: number, lng: number) {
    this.lat = lat
    this.lng = lng
    this.draw()
  }
}

export default function MapPin({ map, member, lat, lng, onClick }: MapPinProps) {
  const overlayRef = useRef<MemberPinOverlay | null>(null)

  useEffect(() => {
    const overlay = new MemberPinOverlay(member, lat, lng, onClick)
    overlay.setMap(map)
    overlayRef.current = overlay

    return () => {
      overlay.setMap(null)
    }
  }, [map, member.id])

  useEffect(() => {
    overlayRef.current?.updatePosition(lat, lng)
  }, [lat, lng])

  return null
}
