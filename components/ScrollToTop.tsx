'use client'

import { useEffect, useState } from 'react'
import { useStringScroll } from '@/lib/useStringScroll'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const instance = useStringScroll()

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    if (instance) {
      instance.scrollTo(0)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <button
      onClick={scrollToTop}
      className={`scroll-to-top ${visible ? 'visible' : ''}`}
      aria-label="Scroll to top"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M10 15V5M5 10l5-5 5 5" />
      </svg>
    </button>
  )
}

