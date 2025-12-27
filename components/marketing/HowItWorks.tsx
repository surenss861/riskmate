'use client'

import { motion } from 'framer-motion'
import { colors, spacing } from '@/lib/design-system/tokens'

/**
 * How It Works Section
 * 
 * 3-step visual flow showing the process
 */
export function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Before the job',
      description: 'Complete hazard checklists, risk assessments, and required controls. Upload photos and capture team signatures—all timestamped automatically.',
    },
    {
      number: '2',
      title: 'During the job',
      description: 'Track site changes, new hazards, and additional photos. See who\'s on-site and who submitted what—your living job log.',
    },
    {
      number: '3',
      title: 'After the job',
      description: 'Generate audit-ready PDF reports with job summary, evidence photos, and compliance trail. Share with clients, insurers, or auditors.',
    },
  ]

  return (
    <section id="how-it-works" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-4xl font-bold text-center mb-12"
          style={{ color: colors.black }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          How it works
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
          {/* Connecting line - hidden on mobile */}
          <div
            className="hidden md:block absolute top-6 left-1/3 right-1/3 h-0.5"
            style={{
              background: `linear-gradient(to right, ${colors.cordovan}30, ${colors.cordovan}50, ${colors.cordovan}30)`,
            }}
          />
          <div
            className="hidden md:block absolute top-6 left-2/3 right-0 h-0.5"
            style={{
              background: `linear-gradient(to right, ${colors.cordovan}30, ${colors.cordovan}50, transparent)`,
            }}
          />

          {/* Mobile: Vertical flow indicator */}
          <div
            className="md:hidden absolute left-6 top-14 bottom-0 w-0.5"
            style={{
              background: `linear-gradient(to bottom, ${colors.cordovan}30, ${colors.cordovan}50, transparent)`,
            }}
          />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="text-center relative z-10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-bold mx-auto mb-4"
                style={{
                  backgroundColor: colors.cordovan + '20',
                  color: colors.cordovan,
                }}
              >
                {step.number}
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: colors.black }}>
                {step.title}
              </h3>
              <p style={{ color: colors.gray600 }}>{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

