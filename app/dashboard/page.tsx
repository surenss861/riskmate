'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const OperationsDashboard = dynamic(
  () => import('../operations/page').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60">Loading dashboard...</p>
        </div>
      </div>
    ),
  }
)

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      }
    >
      <OperationsDashboard />
    </Suspense>
  )
}
