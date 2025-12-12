'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface Worker {
  id: string
  name: string
  email: string
  role: string
  checkedIn: boolean
  checkedInAt?: string
  jobsAssigned: number
  avatarUrl?: string
}

// Helper to get initials for avatar
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface JobAssignmentProps {
  jobId: string
  workers: Worker[]
  onAssign: (workerId: string) => Promise<void>
  onUnassign: (workerId: string) => Promise<void>
  onCheckIn: (workerId: string) => Promise<void>
  onCheckOut: (workerId: string) => Promise<void>
  userRole: 'owner' | 'admin' | 'member'
}

export function JobAssignment({
  jobId,
  workers,
  onAssign,
  onUnassign,
  onCheckIn,
  onCheckOut,
  userRole,
}: JobAssignmentProps) {
  const [assigning, setAssigning] = useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)

  const canManage = userRole === 'owner' || userRole === 'admin'
  const assignedWorkers = workers.filter((w) => w.jobsAssigned > 0)

  return (
    <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Job Assignment</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Assign workers to this job and track on-site check-ins.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold text-sm transition-colors"
          >
            + Assign Worker
          </button>
        )}
      </div>

      <div className="space-y-3">
        {assignedWorkers.length === 0 ? (
          <div className="text-center py-8 border border-white/10 rounded-lg bg-[#121212]/40">
            <p className="text-sm text-white font-medium mb-2">No workers assigned</p>
            <p className="text-xs text-white/60 max-w-md mx-auto">
              {canManage
                ? 'Assign workers to track accountability and create an audit trail of who worked on this job. All assignments are logged for compliance.'
                : 'No workers have been assigned to this job yet. Only owners and admins can manage assignments.'}
            </p>
          </div>
        ) : (
          assignedWorkers.map((worker) => (
            <div
              key={worker.id}
              className="p-4 rounded-lg border border-white/10 bg-[#121212]/60"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {/* Avatar */}
                    <div className="relative group">
                      {worker.avatarUrl ? (
                        <img
                          src={worker.avatarUrl}
                          alt={worker.name}
                          className="w-8 h-8 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-white/10 bg-[#F97316]/20 flex items-center justify-center text-xs font-semibold text-[#F97316]">
                          {getInitials(worker.name)}
                        </div>
                      )}
                      {/* Hover Tooltip */}
                      <div className="absolute left-0 top-full mt-2 px-2 py-1 bg-[#121212] border border-white/10 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                        {worker.name} • {worker.email}
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{worker.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-lg border border-white/10 bg-[#121212] text-white/70">
                      {worker.role}
                    </span>
                    {worker.checkedIn && (
                      <span className="text-xs px-2 py-0.5 rounded border bg-green-500/20 text-green-400 border-green-500/30">
                        On Site
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">{worker.email}</p>
                  {worker.checkedInAt && (
                    <p className="text-xs text-white/40 mt-1">
                      Checked in: {new Date(worker.checkedInAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!worker.checkedIn ? (
                    <button
                      onClick={() => onCheckIn(worker.id)}
                      className="px-3 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                      Check In
                    </button>
                  ) : (
                    <button
                      onClick={() => onCheckOut(worker.id)}
                      className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-colors"
                    >
                      Check Out
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => onUnassign(worker.id)}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

