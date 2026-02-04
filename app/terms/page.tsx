'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'

export default function TermsPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Glass Sticky Navbar */}
      <nav 
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled 
            ? 'backdrop-blur-md bg-black/60 border-b border-white/10' 
            : 'backdrop-blur-sm bg-black/40 border-b border-white/5'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between py-4 px-6">
          <motion.div 
            className="flex items-center gap-3 cursor-pointer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            onClick={() => router.push('/')}
          >
            <Image 
              src="/riskmatefinal.png" 
              alt="Riskmate" 
              width={28} 
              height={28}
              className="h-7 w-auto"
              priority
            />
            <span className="text-white/90 font-medium tracking-wide text-sm">Riskmate</span>
          </motion.div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-white/70 hover:text-white transition-colors text-sm relative group"
            >
              Home
              <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-white group-hover:w-full transition-all duration-300" />
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-16" />

      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-5xl font-bold mb-4 font-display">Terms of Service</h1>
        <p className="text-[#A1A1A1] mb-12">Last updated: November 2025</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-[#A1A1A1]">
              By accessing or using Riskmate (&quot;the Service&quot;), you agree to be bound by these Terms of Service. 
              If you do not agree, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Use of Service</h2>
            <p className="text-[#A1A1A1] mb-4">To use Riskmate, you must:</p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>Be at least 18 years of age</li>
              <li>Provide accurate and complete information when creating an account</li>
              <li>Maintain the security of your account credentials</li>
              <li>Use the Service only for lawful purposes</li>
            </ul>
            <p className="text-[#A1A1A1] mt-4 mb-4">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>Misuse, reverse engineer, or attempt to extract the source code of Riskmate</li>
              <li>Use the Service to violate any laws or regulations</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Impersonate others or provide false information</li>
              <li>Share your account credentials with others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Account & Access</h2>
            <p className="text-[#A1A1A1] mb-4">
              You are responsible for maintaining the confidentiality of your account credentials. 
              Riskmate uses Supabase for authentication and account management.
            </p>
            <p className="text-[#A1A1A1]">
              You are responsible for all activities that occur under your account. Notify us immediately 
              if you suspect unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Payment & Billing</h2>
            <p className="text-[#A1A1A1] mb-4">
              Riskmate offers subscription plans processed through Stripe or Whop:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li><strong className="text-white">Subscriptions:</strong> Automatically renew monthly unless cancelled</li>
              <li><strong className="text-white">Cancellation:</strong> You may cancel anytime through your account settings</li>
              <li><strong className="text-white">Price Changes:</strong> We may modify pricing with 30 days notice</li>
              <li><strong className="text-white">Payment Processing:</strong> Subject to Stripe&apos;s or Whop&apos;s terms of service</li>
            </ul>
            <div className="mt-6 p-4 bg-[#121212] rounded-lg border border-white/10">
              <h3 className="text-lg font-semibold mb-2 text-white">No Refunds</h3>
              <p className="text-[#A1A1A1] mb-2">
                All payments made to Riskmate are non-refundable.
              </p>
              <p className="text-[#A1A1A1] mb-2">
                Subscriptions automatically renew unless cancelled before the renewal date.
              </p>
              <p className="text-[#A1A1A1]">
                We do not provide partial, prorated, or retrospective refunds for unused time, early cancellation, or dissatisfaction with the Service.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
            <p className="text-[#A1A1A1] mb-4">
              Riskmate and its content (including software, design, logos, and documentation) are owned by Riskmate 
              and protected by copyright and trademark laws.
            </p>
            <p className="text-[#A1A1A1]">
              You retain ownership of all data and reports you upload or generate using Riskmate. 
              By using the Service, you grant Riskmate a license to store and process your data solely to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Risk Assessment Disclaimers</h2>
            <p className="text-[#A1A1A1] mb-4">
              <strong className="text-white">Important:</strong> Riskmate generates risk assessment reports based on user-provided information and automated analysis. 
              These reports are intended solely for informational purposes and should not be relied upon for regulatory compliance, safety certification, or insurance coverage.
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>Riskmate reports do not replace professional safety inspections, certifications, or legal advice</li>
              <li>Users are solely responsible for verifying the accuracy of their inputs and for any actions or outcomes based on Riskmate reports</li>
              <li>Riskmate does not guarantee safety outcomes or compliance with regulations</li>
              <li>You assume all responsibility for decisions made based on Riskmate reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Insurance and Injury Disclaimer</h2>
            <p className="text-[#A1A1A1] mb-4">
              Riskmate does not provide insurance coverage, safety certifications, or guarantees of injury prevention.
            </p>
            <p className="text-[#A1A1A1] mb-4">
              The Service and its risk reports are informational tools only and do not replace professional safety audits, inspections, or legally required insurance documentation.
            </p>
            <p className="text-[#A1A1A1]">
              Riskmate, its owners, and affiliates are not responsible for any injury, loss, damage, or insurance claim arising from use or reliance on the Service or its reports.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-[#A1A1A1] mb-4">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>Riskmate is provided &quot;as is&quot; without warranties of any kind</li>
              <li>We are not liable for indirect, incidental, or consequential damages</li>
              <li>Our total liability is limited to the amount you paid in the 12 months preceding a claim</li>
              <li>We are not responsible for third-party services (Supabase, Stripe, Whop) or their failures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Third-Party Integrations</h2>
            <p className="text-[#A1A1A1] mb-4">
              Riskmate uses the following third-party services:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li><strong className="text-white">Supabase:</strong> Database, authentication, and storage (subject to Supabase&apos;s terms)</li>
              <li><strong className="text-white">Stripe / Whop:</strong> Payment processing (subject to their respective terms)</li>
              <li><strong className="text-white">PostHog:</strong> Analytics (subject to PostHog&apos;s privacy policy)</li>
            </ul>
            <p className="text-[#A1A1A1] mt-4">
              Your use of these services is subject to their respective terms and privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
            <p className="text-[#A1A1A1] mb-4">
              We may suspend or terminate your access to Riskmate if:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>You violate these Terms of Service</li>
              <li>You engage in fraudulent or illegal activity</li>
              <li>Your account remains inactive for an extended period</li>
              <li>Required by law or court order</li>
            </ul>
            <p className="text-[#A1A1A1] mt-4">
              You may terminate your account at any time by cancelling your subscription and deleting your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
            <p className="text-[#A1A1A1]">
              These Terms are governed by the laws of Ontario, Canada. Any disputes will be resolved in the courts of Ontario, Canada.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Updates to Terms</h2>
            <p className="text-[#A1A1A1]">
              We may update these Terms of Service from time to time. We will notify you of material changes by email 
              or through the Service. Continued use after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-[#A1A1A1] mb-4">
              For questions about these Terms, contact us:
            </p>
            <p className="text-[#A1A1A1]">
              Email: <a href="mailto:legal@riskmate.com" className="text-[#F97316] hover:underline">legal@riskmate.com</a><br />
              Built in North America
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

