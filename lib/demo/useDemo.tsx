'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { demoData, getDemoDataForRole, type DemoRole } from './demoData'

interface DemoContextType {
  isDemo: boolean
  currentRole: DemoRole
  setCurrentRole: (role: DemoRole) => void
  data: ReturnType<typeof getDemoDataForRole>
  showDemoMessage: (action: string) => void
}

const DemoContext = createContext<DemoContextType | null>(null)

export function DemoProvider({ 
  children, 
  initialRole = 'owner' 
}: { 
  children: ReactNode
  initialRole?: DemoRole 
}) {
  const [currentRole, setCurrentRole] = useState<DemoRole>(initialRole)
  const [demoMessage, setDemoMessage] = useState<string | null>(null)

  const showDemoMessage = (action: string) => {
    const message = `Demo mode: ${action} simulated. In production, this would write to audit logs and enforce governance.`
    setDemoMessage(message)
    setTimeout(() => setDemoMessage(null), 5000)
  }

  const data = getDemoDataForRole(currentRole)

  return (
    <DemoContext.Provider
      value={{
        isDemo: true,
        currentRole,
        setCurrentRole,
        data,
        showDemoMessage,
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
      data: demoData,
      showDemoMessage: () => {},
    }
  }
  return context
}

