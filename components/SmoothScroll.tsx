'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'

export function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null)
  const rafRef = useRef<number | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    let lenis: Lenis | null = null
    let rafId: number | null = null
    let handleResize: (() => void) | null = null
    let handleHashClick: ((e: MouseEvent) => void) | null = null

    // Initialize Lenis smooth scroll
    const initLenis = () => {
      // Don't initialize if already exists
      if (lenisRef.current) return

      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        infinite: false,
      })

      lenisRef.current = lenis

      // Add lenis class to html
      document.documentElement.classList.add('lenis', 'lenis-smooth')

      // Animation frame loop
      function raf(time: number) {
        if (lenis) {
          lenis.raf(time)
          rafId = requestAnimationFrame(raf)
        }
      }

      rafId = requestAnimationFrame(raf)

      // Recalculate scroll on resize
      handleResize = () => {
        if (lenis) lenis.resize()
      }
      window.addEventListener('resize', handleResize)

      // Handle hash links with smooth scroll
      handleHashClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        const link = target.closest('a[href^="#"]')
        if (link && lenis) {
          const href = link.getAttribute('href')
          if (href && href !== '#') {
            e.preventDefault()
            const targetId = href.slice(1)
            const targetElement = document.getElementById(targetId)
            if (targetElement) {
              lenis.scrollTo(targetElement, {
                offset: -80,
                duration: 1.5,
              })
            }
          }
        }
      }

      document.addEventListener('click', handleHashClick)
    }

    // Initialize immediately if DOM is ready, otherwise wait
    if (typeof window !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLenis)
      } else {
        // Small delay to ensure everything is ready
        setTimeout(initLenis, 0)
      }
    }

    // Cleanup
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      if (handleResize) {
        window.removeEventListener('resize', handleResize)
      }
      if (handleHashClick) {
        document.removeEventListener('click', handleHashClick)
      }
      if (lenis) {
        lenis.destroy()
      }
      if (lenisRef.current) {
        lenisRef.current = null
      }
      document.documentElement.classList.remove('lenis', 'lenis-smooth')
    }
  }, [])

  // Recalculate scroll when route changes
  useEffect(() => {
    if (lenisRef.current) {
      // Small delay to allow page content to render
      setTimeout(() => {
        if (lenisRef.current) {
          lenisRef.current.resize()
        }
      }, 100)
    }
  }, [pathname])

  return null
}

