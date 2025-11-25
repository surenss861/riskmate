'use client'

import { useEffect, useRef } from 'react'

// TypeScript declarations for StringTune (from @fiddle-digital/string-tune)
declare global {
  interface Window {
    StringTune?: {
      StringTune: {
        getInstance(): StringTuneInstance
      }
      StringParallaxAnimation: any
      StringProgressAnimation: any
      StringShowAnimation: any
      StringLerpAnimation: any
      StringScrollbar: any
      StringTracker: any
      StringLazy: any
    }
  }
}

interface StringTuneInstance {
  use(module: any): void
  start(delay?: number): void
  enabled: boolean
  scrollTo(position: number): void
  on(event: string, handler: Function, id?: string): void
  off(event: string, handler: Function, id?: string): void
}

export function useStringScroll() {
  const instanceRef = useRef<StringTuneInstance | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    // Wait for StringTune to be available (loaded via script tag)
    if (typeof window === 'undefined' || initializedRef.current) return

    const initStringTune = () => {
      if (!window.StringTune?.StringTune) {
        // Retry after a short delay if not loaded yet
        setTimeout(initStringTune, 100)
        return
      }

      try {
        const stringInstance = window.StringTune.StringTune.getInstance()
        
        // Register animation modules if available
        if (window.StringTune.StringParallaxAnimation) {
          stringInstance.use(window.StringTune.StringParallaxAnimation)
        }
        if (window.StringTune.StringProgressAnimation) {
          stringInstance.use(window.StringTune.StringProgressAnimation)
        }
        if (window.StringTune.StringShowAnimation) {
          stringInstance.use(window.StringTune.StringShowAnimation)
        }
        // Optional: Add scrollbar and tracker for dev
        if (process.env.NODE_ENV === 'development') {
          if (window.StringTune.StringScrollbar) {
            stringInstance.use(window.StringTune.StringScrollbar)
          }
          if (window.StringTune.StringTracker) {
            stringInstance.use(window.StringTune.StringTracker)
          }
        }

        // Configure smooth scrolling
        // StringTune handles smooth scrolling internally, but we ensure CSS is set
        if (typeof document !== 'undefined') {
          document.documentElement.style.scrollBehavior = 'smooth'
          document.body.style.scrollBehavior = 'smooth'
        }
        
        // Start the scroll system (delay 0 = immediate)
        stringInstance.start(0)
        
        instanceRef.current = stringInstance
        initializedRef.current = true
      } catch (error) {
        console.warn('StringTune initialization failed:', error)
      }
    }

    initStringTune()

    return () => {
      // Cleanup on unmount
      if (instanceRef.current) {
        try {
          instanceRef.current.enabled = false
        } catch (error) {
          console.warn('StringTune cleanup failed:', error)
        }
      }
    }
  }, [])

  return instanceRef.current
}

