'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { demoData, getDemoDataForRole, type DemoRole, type DemoScenario } from './demoData'

interface DemoContextType {
  isDemo: boolean
  currentRole: DemoRole
  setCurrentRole: (role: DemoRole) => void
  currentScenario: DemoScenario
  setCurrentScenario: (scenario: DemoScenario) => void
  data: ReturnType<typeof getDemoDataForRole>
  showDemoMessage: (action: string) => void
  resetDemo: () => void
  copyDemoLink: () => void
}

const DemoContext = createContext<DemoContextType | null>(null)

export function DemoProvider({ 
  children, 
  initialRole = 'owner',
  initialScenario = 'normal'
}: { 
  children: ReactNode
  initialRole?: DemoRole
  initialScenario?: DemoScenario
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Read from URL params or use defaults
  const urlRole = (searchParams?.get('role') as DemoRole) || initialRole
  const urlScenario = (searchParams?.get('scenario') as DemoScenario) || initialScenario
  
  const [currentRole, setCurrentRole] = useState<DemoRole>(urlRole)
  const [currentScenario, setCurrentScenario] = useState<DemoScenario>(urlScenario)
  const [demoMessage, setDemoMessage] = useState<string | null>(null)
  const [localState, setLocalState] = useState<any>(null)

  // Sync with URL params on mount
  useEffect(() => {
    if (urlRole !== currentRole) setCurrentRole(urlRole)
    if (urlScenario !== currentScenario) setCurrentScenario(urlScenario)
  }, [urlRole, urlScenario])

  // Update URL when role/scenario changes
  const updateRole = (role: DemoRole) => {
    setCurrentRole(role)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('role', role)
    if (currentScenario !== 'normal') params.set('scenario', currentScenario)
    router.push(`/demo?${params.toString()}`, { scroll: false })
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('demo_role', role)
      localStorage.setItem('demo_scenario', currentScenario)
    }
  }

  const updateScenario = (scenario: DemoScenario) => {
    setCurrentScenario(scenario)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('scenario', scenario)
    if (currentRole !== 'owner') params.set('role', currentRole)
    router.push(`/demo?${params.toString()}`, { scroll: false })
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('demo_role', currentRole)
      localStorage.setItem('demo_scenario', scenario)
    }
  }

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !searchParams?.get('role')) {
      const savedRole = localStorage.getItem('demo_role') as DemoRole
      const savedScenario = localStorage.getItem('demo_scenario') as DemoScenario
      if (savedRole) setCurrentRole(savedRole)
      if (savedScenario) setCurrentScenario(savedScenario)
    }
  }, [])

  const showDemoMessage = (action: string) => {
    const message = `Demo mode: ${action} simulated. In production, this would write to audit logs and enforce governance.`
    setDemoMessage(message)
    setTimeout(() => setDemoMessage(null), 5000)
  }

  const resetDemo = () => {
    setLocalState(null)
    setCurrentRole('owner')
    setCurrentScenario('normal')
    router.push('/demo?role=owner&scenario=normal', { scroll: false })
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demo_role')
      localStorage.removeItem('demo_scenario')
    }
  }

  const copyDemoLink = () => {
    const params = new URLSearchParams()
    params.set('role', currentRole)
    params.set('scenario', currentScenario)
    const url = `${window.location.origin}/demo?${params.toString()}`
    navigator.clipboard.writeText(url)
    showDemoMessage('Demo link copied to clipboard')
  }

  const data = getDemoDataForRole(currentRole, currentScenario)

  return (
    <DemoContext.Provider
      value={{
        isDemo: true,
        currentRole,
        setCurrentRole: updateRole,
        currentScenario,
        setCurrentScenario: updateScenario,
        data,
        showDemoMessage,
        resetDemo,
        copyDemoLink,
      }}
    >
      {children}
      {demoMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg bg-[#F97316] px-4 py-3 text-sm text-black shadow-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>{demoMessage}</p>
          </div>
        </div>
      )}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) {
    // Not in demo mode - return default values
    return {
      isDemo: false,
      currentRole: 'member' as DemoRole,
      setCurrentRole: () => {},
      currentScenario: 'normal' as DemoScenario,
      setCurrentScenario: () => {},
      data: demoData,
      showDemoMessage: () => {},
      resetDemo: () => {},
      copyDemoLink: () => {},
    }
  }
  return context
}

