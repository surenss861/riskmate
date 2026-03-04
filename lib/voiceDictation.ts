/**
 * Web Speech API dictation. Use for search inputs (e.g. jobs search).
 * If SpeechRecognition is unsupported, call onError and do not start.
 */

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function startDictation(opts: {
  onResult: (text: string) => void
  onError?: (err: unknown) => void
  onEnd?: () => void
}): () => void {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) {
    opts.onError?.(new Error('Speech recognition not supported'))
    return () => {}
  }

  const rec = new Ctor() as SpeechRecognitionInstance
  rec.lang = 'en-US'
  rec.continuous = false
  rec.interimResults = false
  rec.maxAlternatives = 1

  rec.onresult = (e: SpeechRecognitionEvent) => {
    const text = e.results?.[0]?.[0]?.transcript ?? ''
    if (text) opts.onResult(text.trim())
  }

  rec.onerror = (e: SpeechRecognitionErrorEvent) => {
    if (e.error !== 'aborted') opts.onError?.(e)
  }

  rec.onend = () => opts.onEnd?.()

  rec.start()
  return () => {
    try {
      rec.abort()
    } catch {
      try {
        rec.stop()
      } catch {}
    }
  }
}
