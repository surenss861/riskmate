'use client'

import { motion } from 'framer-motion'
import { Card } from '@/lib/design-system/components/Card'
import { colors } from '@/lib/design-system/tokens'

/**
 * Social Proof Section
 * 
 * Shows testimonials, logos, and trust signals
 */
export function SocialProof() {
  const testimonials = [
    {
      quote: 'Riskmate cut my reporting time in half. Clients love the professional PDFs.',
      author: 'James L.',
      role: 'Electrical Contractor',
    },
    {
      quote: 'The Permit Pack feature pays for itself every week. No more scrambling for documents.',
      author: 'Hector R.',
      role: 'Roofing Company Owner',
    },
    {
      quote: 'My team actually follows safety protocols now because it&apos;s so easy to document.',
      author: 'Carla M.',
      role: 'HVAC Supervisor',
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
            Built with real contractors
          </h2>
          <p className="text-lg" style={{ color: colors.gray600 }}>
            Riskmate was built with feedback from dozens of electricians, roofers, HVAC technicians, and renovators during beta testing.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card variant="elevated" padding="lg">
                <p className="italic mb-4" style={{ color: colors.gray700 }}>
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div>
                  <p className="font-semibold" style={{ color: colors.black }}>
                    {testimonial.author}
                  </p>
                  <p className="text-sm" style={{ color: colors.gray600 }}>
                    {testimonial.role}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Trust badges */}
        <motion.div
          className="flex flex-wrap justify-center gap-4 text-sm"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="px-4 py-2 rounded-lg border" style={{ borderColor: colors.borderLight, backgroundColor: colors.bgPrimary }}>
            Audit-ready documentation
          </div>
          <div className="px-4 py-2 rounded-lg border" style={{ borderColor: colors.borderLight, backgroundColor: colors.bgPrimary }}>
            Timestamped evidence trail
          </div>
          <div className="px-4 py-2 rounded-lg border" style={{ borderColor: colors.borderLight, backgroundColor: colors.bgPrimary }}>
            Insurer-approved reports
          </div>
        </motion.div>
      </div>
    </section>
  )
}

