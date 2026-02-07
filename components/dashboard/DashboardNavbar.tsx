'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskmateLogo from '@/components/RiskmateLogo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface DashboardNavbarProps {
  email?: string | null
  onLogout?: () => void
}

const ALL_NAV_ITEMS = [
  { label: 'Operations', href: '/operations', roles: ['owner', 'admin', 'member', 'safety_lead', 'executive'] },
  { label: 'Compliance Ledger', href: '/operations/audit', roles: ['owner', 'admin', 'member', 'safety_lead', 'executive'] },
  { label: 'Audit Readiness', href: '/operations/audit/readiness', roles: ['owner', 'admin', 'safety_lead'] },
  { label: 'Work Records', href: '/operations/jobs', roles: ['owner', 'admin', 'member', 'safety_lead'] },
  { label: 'Risk Posture', href: '/operations/executive', roles: ['owner', 'admin', 'executive'] },
  { label: 'Account', href: '/operations/account', roles: ['owner', 'admin'] },
  { label: 'Team', href: '/operations/team', roles: ['owner', 'admin'] },
]

export function DashboardNavbar({ email, onLogout }: DashboardNavbarProps) {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [navOpacity, setNavOpacity] = useState(0.4)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setScrolled(scrollY > 50)
      // Dynamic opacity based on scroll (matching landing page)
      if (scrollY > 50) {
        setNavOpacity(Math.min(0.6 + (scrollY - 50) / 200, 0.8))
      } else {
        setNavOpacity(0.4)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: userRow } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()

          setUserRole(userRow?.role ?? 'member')
        } else {
          setUserRole('member')
        }
      } catch (error) {
        console.error('Failed to load user role:', error)
        setUserRole('member')
      } finally {
        setLoading(false)
      }
    }

    loadUserRole()
  }, [])

  // Filter nav items based on user role
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (!userRole) return false
    return item.roles.includes(userRole)
  })

  return (
    <nav 
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled 
          ? 'backdrop-blur-xl border-b border-white/10' 
          : 'backdrop-blur-md border-b border-white/5'
      }`}
      style={{ backgroundColor: `rgba(0, 0, 0, ${navOpacity})` }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-6">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <RiskmateLogo size="sm" showText />
          </motion.div>
          {!loading && (
            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute -bottom-2.5 left-0 right-0 h-[2px] rounded-full bg-[#F97316]" />
                    )}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {email && <span className="truncate text-sm text-white/60">{email}</span>}
          {onLogout && (
            <button
              onClick={onLogout}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/50 transition-all hover:border-white/20 hover:text-white/70"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

