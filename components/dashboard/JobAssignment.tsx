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
    <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
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
          <div className="text-center py-8 border border-white/10 rounded-lg bg-black/20">
            <p className="text-sm text-white/50 mb-2">No workers assigned</p>
            <p className="text-xs text-white/40">
              {canManage
                ? 'Assign workers to track who\'s working on this job'
                : 'No workers have been assigned to this job yet'}
            </p>
          </div>
        ) : (
          assignedWorkers.map((worker) => (
            <div
              key={worker.id}
              className="p-4 rounded-lg border border-white/10 bg-white/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-white">{worker.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded border bg-white/5 text-white/70">
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
                      className="px-3 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors"
                    >
                      Check In
                    </button>
                  ) : (
                    <button
                      onClick={() => onCheckOut(worker.id)}
                      className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500/30 transition-colors"
                    >
                      Check Out
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => onUnassign(worker.id)}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
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

