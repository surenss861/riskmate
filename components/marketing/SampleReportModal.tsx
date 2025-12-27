'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/lib/design-system/components/Card'
import { Button } from '@/lib/design-system/components/Button'
import { colors, zIndex } from '@/lib/design-system/tokens'

interface SampleReportModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Sample Report Preview Modal
 * 
 * Shows a preview of the generated PDF report
 * Can be expanded to show full report or link to /sample-report page
 */
export function SampleReportModal({ isOpen, onClose }: SampleReportModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0"
            style={{
              backgroundColor: colors.glassBlack,
              zIndex: zIndex.modalBackdrop,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center p-6"
            style={{ zIndex: zIndex.modal }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Card variant="elevated" padding="lg" className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.black }}>
                    Sample Risk Snapshot Report
                  </h2>
                  <p style={{ color: colors.gray600 }}>
                    See what your clients and insurers will receive
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-2xl leading-none"
                  style={{ color: colors.gray600 }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Report Preview */}
              <div className="border rounded-lg overflow-hidden mb-6" style={{ borderColor: colors.borderLight }}>
                <div className="aspect-[8.5/11] bg-white p-8">
                  {/* Mock report content */}
                  <div className="space-y-6">
                    {/* Cover */}
                    <div className="text-center py-12 border-b" style={{ borderColor: colors.borderLight }}>
                      <h1 className="text-3xl font-bold mb-4" style={{ color: colors.black }}>
                        Risk Snapshot Report
                      </h1>
                      <p style={{ color: colors.gray600 }}>Sample Job • Electrical Panel Upgrade</p>
                    </div>

                    {/* Executive Summary */}
                    <div>
                      <h2 className="text-xl font-bold mb-4" style={{ color: colors.black }}>
                        Executive Summary
                      </h2>
                      <p style={{ color: colors.gray600 }}>
                        This report demonstrates RiskMate's professional PDF generation. The actual report includes
                        detailed hazard checklists, risk scores, mitigation tracking, photo evidence, and compliance signatures.
                      </p>
                    </div>

                    {/* KPI Pills */}
                    <div className="flex gap-4">
                      <div className="flex-1 p-4 rounded-lg border text-center" style={{ borderColor: colors.borderLight }}>
                        <div className="text-2xl font-bold mb-1" style={{ color: colors.cordovan }}>78</div>
                        <div className="text-sm" style={{ color: colors.gray600 }}>Risk Score</div>
                      </div>
                      <div className="flex-1 p-4 rounded-lg border text-center" style={{ borderColor: colors.borderLight }}>
                        <div className="text-2xl font-bold mb-1" style={{ color: colors.black }}>12</div>
                        <div className="text-sm" style={{ color: colors.gray600 }}>Hazards</div>
                      </div>
                      <div className="flex-1 p-4 rounded-lg border text-center" style={{ borderColor: colors.borderLight }}>
                        <div className="text-2xl font-bold mb-1" style={{ color: colors.black }}>8/10</div>
                        <div className="text-sm" style={{ color: colors.gray600 }}>Controls</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Button
                  variant="primary"
                  onClick={() => {
                    window.open('/sample-report', '_blank')
                    onClose()
                  }}
                >
                  View Full Sample Report
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

