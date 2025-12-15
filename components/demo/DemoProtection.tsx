'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Demo Protection Component
 * Prevents navigation outside demo-safe routes
 * Shows calm message for disabled actions
 * Blocks all production routes (/operations, /api, etc.)
 */
const ALLOWED_ROUTES = ['/demo', '/pricing']

export function DemoProtection({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Block all routes except allowed ones
    if (pathname) {
      const isAllowed = ALLOWED_ROUTES.some(route => {
        if (route === '/pricing') {
          // Allow /pricing with or without query params
          return pathname === '/pricing' || pathname.startsWith('/pricing?')
        }
        return pathname.startsWith(route)
      })

      // Block dashboard, API, account, and any other production routes
      const isBlocked = 
        pathname.startsWith('/operations') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/account') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/reset') ||
        (!isAllowed && pathname !== '/')

      if (isBlocked) {
        router.push('/demo')
        // Show calm message after redirect
        setTimeout(() => {
          showDemoDisabledMessage('This route is not available in demo mode.')
        }, 100)
      }
    }
  }, [pathname, router])

  // Intercept dangerous actions (clicks on blocked links)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Check for dangerous actions
      if (
        target.closest('[data-demo-disabled]') ||
        target.closest('a[href^="/operations"]') ||
        target.closest('a[href^="/api"]') ||
        target.closest('a[href^="/account"]') ||
        target.closest('a[href^="/login"]') ||
        target.closest('a[href^="/signup"]')
      ) {
        e.preventDefault()
        e.stopPropagation()
        showDemoDisabledMessage()
      }
    }

    // Also intercept programmatic navigation attempts
    const handlePopState = () => {
      if (pathname && !ALLOWED_ROUTES.some(route => pathname.startsWith(route))) {
        router.push('/demo')
      }
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [pathname, router])

  const showDemoDisabledMessage = (customMessage?: string) => {
    // Create a calm, non-intrusive message
    const message = document.createElement('div')
    message.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#121212] border border-white/20 text-white px-4 py-3 rounded-lg shadow-lg text-sm'
    message.textContent = customMessage || 'Disabled in demo mode. No data is saved.'
    
    document.body.appendChild(message)
    
    setTimeout(() => {
      message.style.opacity = '0'
      message.style.transition = 'opacity 0.3s'
      setTimeout(() => message.remove(), 300)
    }, 2000)
  }

  return <>{children}</>
}

