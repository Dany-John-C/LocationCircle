import { useCallback, useRef, useState } from 'react'

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const isSupported = 'speechSynthesis' in window

  const speak = useCallback((text: string) => {
    if (!isSupported) return

    // Cancel any current speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 1.0
    utterance.lang = 'en-US'

    // Use first available English voice
    const voices = window.speechSynthesis.getVoices()
    const enVoice = voices.find((v) => v.lang.startsWith('en'))
    if (enVoice) utterance.voice = enVoice

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [isSupported])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  const readMemberRow = useCallback(
    (
      name: string,
      locality?: string,
      distance?: string,
      carEta?: string,
      transitEta?: string,
    ) => {
      const parts = [name]
      if (locality) parts.push(locality)
      if (distance) parts.push(distance)
      if (carEta) parts.push(`${carEta} by car`)
      if (transitEta) parts.push(`${transitEta} by public transport`)
      speak(parts.join(', ') + '.')
    },
    [speak],
  )

  return { speak, stop, isSpeaking, isSupported, readMemberRow }
}
