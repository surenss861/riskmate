'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { colors } from '@/lib/design-system/tokens'

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Marketing Hero Component
 * 
 * Features:
 * - GSAP scroll-triggered animations
 * - Three.js background (lightweight particles/gradient)
 * - Clear CTA + value proposition
 * - Responsive + performant
 */
export function MarketingHero() {
  const heroRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const [threeLoaded, setThreeLoaded] = useState(false)

  useEffect(() => {
    if (!heroRef.current) return

    const ctx = gsap.context(() => {
      // Title animation
      gsap.from(titleRef.current, {
        opacity: 0,
        y: 30,
        duration: 1,
        ease: 'power3.out',
      })

      // Subtitle animation
      gsap.from(subtitleRef.current, {
        opacity: 0,
        y: 20,
        duration: 1,
        delay: 0.2,
        ease: 'power3.out',
      })

      // CTA animation
      gsap.from(ctaRef.current, {
        opacity: 0,
        y: 20,
        duration: 1,
        delay: 0.4,
        ease: 'power3.out',
      })

      // Parallax on scroll
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          if (titleRef.current) {
            gsap.to(titleRef.current, {
              y: self.progress * 50,
              opacity: 1 - self.progress * 0.5,
            })
          }
        },
      })
    }, heroRef)

    return () => ctx.revert()
  }, [])

  // Lazy-load Three.js background
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Only load on desktop and if user hasn't reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth < 768

    if (prefersReducedMotion || isMobile) {
      // Use static gradient fallback
      return
    }

    // Dynamic import for Three.js
    import('@/components/marketing/HeroBackground').then((module) => {
      setThreeLoaded(true)
    })
  }, [])

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%)',
      }}
    >
      {/* Three.js Background (lazy-loaded) */}
      {threeLoaded && (
        <div className="absolute inset-0 z-0">
          {/* HeroBackground component will be rendered here */}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
        <h1
          ref={titleRef}
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6"
          style={{ color: colors.black }}
        >
          Risk Snapshot Reports
          <br />
          <span style={{ color: colors.cordovan }}>That Actually Scale</span>
        </h1>

        <p
          ref={subtitleRef}
          className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto"
          style={{ color: colors.gray600 }}
        >
          Generate insurance-ready safety reports in seconds. Trusted by contractors,
          compliance teams, and insurance providers.
        </p>

        <div ref={ctaRef} className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            className="px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105"
            style={{
              backgroundColor: colors.cordovan,
              color: colors.white,
              boxShadow: `0 4px 14px 0 ${colors.cordovan}40`,
            }}
          >
            Get a Risk Snapshot
          </button>
          <button
            className="px-8 py-4 rounded-lg font-semibold text-lg border-2 transition-all hover:scale-105"
            style={{
              borderColor: colors.cordovan,
              color: colors.cordovan,
              backgroundColor: 'transparent',
            }}
          >
            See Sample Report
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="animate-bounce">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: colors.gray600 }}
          >
            <path
              d="M7 10L12 15L17 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </section>
  )
}

