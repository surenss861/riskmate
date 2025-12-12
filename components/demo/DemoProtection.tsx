'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Demo Protection Component
 * Prevents navigation outside demo-safe routes
 * Shows calm message for disabled actions
 */
export function DemoProtection({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only allow demo route
    if (pathname && !pathname.startsWith('/demo')) {
      router.push('/demo')
    }
  }, [pathname, router])

  // Intercept dangerous actions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Check for dangerous actions
      if (
        target.closest('[data-demo-disabled]') ||
        target.closest('a[href^="/dashboard"]') ||
        target.closest('a[href^="/account"]')
      ) {
        e.preventDefault()
        e.stopPropagation()
        showDemoDisabledMessage()
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  const showDemoDisabledMessage = () => {
    // Create a calm, non-intrusive message
    const message = document.createElement('div')
    message.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#121212] border border-white/20 text-white px-4 py-3 rounded-lg shadow-lg text-sm'
    message.textContent = 'This action is disabled in demo mode.'
    
    document.body.appendChild(message)
    
    setTimeout(() => {
      message.style.opacity = '0'
      message.style.transition = 'opacity 0.3s'
      setTimeout(() => message.remove(), 300)
    }, 2000)
  }

  return <>{children}</>
}

