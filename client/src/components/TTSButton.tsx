import { Volume2, VolumeX } from 'lucide-react'

interface TTSButtonProps {
  onSpeak: () => void
  onStop: () => void
  isSpeaking: boolean
  isSupported: boolean
  label?: string
}

export default function TTSButton({
  onSpeak,
  onStop,
  isSpeaking,
  isSupported,
  label = 'Read member aloud',
}: TTSButtonProps) {
  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={isSpeaking ? onStop : onSpeak}
      aria-label={isSpeaking ? 'Stop reading aloud' : label}
      aria-pressed={isSpeaking}
      className={`
        p-2 rounded-lg transition-all duration-200
        focus-visible:ring-2 focus-visible:ring-accent
        ${isSpeaking
          ? 'bg-teal/30 text-teal-light shadow-glow-teal'
          : 'text-gray-400 hover:text-teal-light hover:bg-teal/10'
        }
      `}
    >
      {isSpeaking ? (
        <VolumeX className="w-5 h-5" aria-hidden="true" />
      ) : (
        <Volume2 className="w-5 h-5" aria-hidden="true" />
      )}
    </button>
  )
}
