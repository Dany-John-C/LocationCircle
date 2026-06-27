import { Phone, MapPin as MapPinIcon } from 'lucide-react'
import type { Member } from '../store/groupStore'
import type { MemberLocation } from '../store/locationStore'
import RoleTag from './RoleTag'
import TTSButton from './TTSButton'
import { useTTS } from '../hooks/useTTS'

interface MemberCardProps {
  member: Member
  location?: MemberLocation
  distance?: string
  carEta?: string
  transitEta?: string
  isCurrentUser?: boolean
  onClick?: () => void
}

export default function MemberCard({
  member,
  location,
  distance,
  carEta,
  transitEta,
  isCurrentUser,
  onClick,
}: MemberCardProps) {
  const { stop, isSpeaking, isSupported, readMemberRow } = useTTS()

  const handleTTS = () => {
    readMemberRow(
      member.name,
      member.sharing ? location?.locality : 'Location paused',
      distance,
      carEta,
      transitEta,
    )
  }

  const isHead = member.role === 'head'
  const isTempHead = member.role === 'temp_head'

  return (
    <li
      className={`
        relative flex items-center gap-3 p-3 rounded-2xl transition-all duration-200
        ${isHead
          ? 'border-2 border-accent/50 bg-accent/5'
          : 'border border-white/8 glass hover:border-white/20'
        }
        ${isTempHead ? 'border border-teal/40' : ''}
        ${isCurrentUser ? 'ring-1 ring-teal/50' : ''}
        cursor-pointer active:scale-[0.99]
      `}
      role="listitem"
      aria-label={`${member.name}, ${member.sharing ? location?.locality ?? 'location unknown' : 'location paused'}, ${distance ?? ''}`}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Head pinned indicator */}
      {isHead && (
        <span
          className="absolute -top-2 left-3 text-accent text-xs font-bold bg-navy-dark px-2 rounded-full"
          aria-hidden="true"
        >
          ★ Group Head
        </span>
      )}

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={`${member.name}'s avatar`}
            className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full bg-teal/30 flex items-center justify-center text-white font-semibold text-lg"
            aria-hidden="true"
          >
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Live pulse dot */}
        {member.sharing && location && (
          <span className="absolute bottom-0 right-0 w-3 h-3" aria-hidden="true">
            <span className="pulse-ring absolute inset-0 rounded-full bg-teal/60" />
            <span className="relative block w-3 h-3 rounded-full bg-teal" />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-white truncate">{member.name}</span>
          {isCurrentUser && (
            <span className="text-xs text-teal-light font-medium">(you)</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm text-gray-400 mb-1" aria-live="polite">
          {!member.sharing ? (
            <span className="italic text-accent">Location paused</span>
          ) : location?.locality ? (
            <>
              <MapPinIcon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{location.locality}</span>
            </>
          ) : (
            <span className="italic">Location updating…</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs" aria-live="polite">
          {distance && (
            <span className="text-teal-light font-medium">{distance}</span>
          )}
          {carEta && (
            <span className="text-gray-400">Car {carEta}</span>
          )}
          {transitEta && (
            <span className="text-gray-400">Transit {transitEta}</span>
          )}
          <RoleTag role={member.role} size="sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <TTSButton
          onSpeak={handleTTS}
          onStop={stop}
          isSpeaking={isSpeaking}
          isSupported={isSupported}
          label={`Read ${member.name}'s details aloud`}
        />

        {member.phone && !isCurrentUser && (
          <a
            href={`tel:${member.phone}`}
            aria-label={`Call ${member.name}`}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10
                       transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-4 h-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
  )
}
