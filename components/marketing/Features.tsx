'use client'

import { motion } from 'framer-motion'
import { Card } from '@/lib/design-system/components/Card'
import { colors } from '@/lib/design-system/tokens'

/**
 * Features Section
 * 
 * Highlights key features: risk scoring, mitigation, PDF, audit trail
 */
export function Features() {
  const features = [
    {
      icon: '📊',
      title: 'Automatic Risk Scoring',
      description: 'AI-powered risk assessment based on hazard checklists. Get instant risk levels (Low, Medium, High, Critical) with detailed breakdowns.',
    },
    {
      icon: '✅',
      title: 'Mitigation Checklists',
      description: 'Auto-generated control measures based on identified hazards. Track completion, assign to team members, and ensure compliance.',
    },
    {
      icon: '📄',
      title: 'Insurance-Ready PDFs',
      description: 'Generate professional reports in seconds. Branded, timestamped, and audit-ready. Share with clients, insurers, or auditors.',
    },
    {
      icon: '📸',
      title: 'Photo Evidence Gallery',
      description: 'Organized photo gallery with GPS and weather metadata. Timestamped automatically. Perfect for proof of work and compliance.',
    },
    {
      icon: '🔍',
      title: 'Complete Audit Trail',
      description: 'Every action is logged with timestamp, user, and reason. Immutable history for compliance and accountability.',
    },
    {
      icon: '👥',
      title: 'Team Collaboration',
      description: 'Role-based access control. Assign jobs, track progress, and ensure the right people see the right information.',
    },
  ]

  return (
    <section className="py-20 px-6" style={{ backgroundColor: colors.bgSecondary }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold mb-4" style={{ color: colors.black }}>
            Everything you need for compliance
          </h2>
          <p className="text-lg" style={{ color: colors.gray600 }}>
            RiskMate combines risk assessment, mitigation tracking, and reporting into one streamlined platform.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <Card variant="elevated" padding="lg" className="h-full">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: colors.black }}>
                  {feature.title}
                </h3>
                <p style={{ color: colors.gray600 }}>{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

