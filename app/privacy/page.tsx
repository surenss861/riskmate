'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'

export default function PrivacyPage() {
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
              alt="RiskMate" 
              width={28} 
              height={28}
              className="h-7 w-auto"
              priority
            />
            <span className="text-white/90 font-medium tracking-wide text-sm">RiskMate</span>
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
        <h1 className="text-5xl font-bold mb-4 font-display">Privacy Policy</h1>
        <p className="text-[#A1A1A1] mb-12">Last updated: January 2025</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-[#A1A1A1] mb-4">
              We collect information you provide directly to us and information automatically collected when you use RiskMate.
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li><strong className="text-white">Account Information:</strong> Name, email address, and password when you create an account</li>
              <li><strong className="text-white">Job Data:</strong> Client names, addresses, job types, risk factors, and mitigation checklists you create</li>
              <li><strong className="text-white">Payment Information:</strong> Processed securely through Stripe or Whop (we do not store credit card details)</li>
              <li><strong className="text-white">Usage Data:</strong> How you interact with the service, features used, and analytics data</li>
              <li><strong className="text-white">Device Information:</strong> IP address, browser type, and device identifiers collected automatically</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-[#A1A1A1] mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>Generate risk assessment reports and PDF documents</li>
              <li>Manage your account and provide customer support</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service-related notifications and updates</li>
              <li>Improve RiskMate&apos;s features and user experience</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Data Sharing</h2>
            <p className="text-[#A1A1A1] mb-4">
              We do not sell your personal data. We may share your information with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li><strong className="text-white">Service Providers:</strong> Supabase (database and authentication), Stripe or Whop (payments), and hosting providers necessary to operate the platform</li>
              <li><strong className="text-white">Legal Requirements:</strong> When required by law, court order, or to protect our rights and safety</li>
              <li><strong className="text-white">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (with notice to users)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Storage & Security</h2>
            <p className="text-[#A1A1A1] mb-4">
              All data is stored securely using Supabase servers with industry-standard security measures:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>SSL/TLS encryption for data in transit</li>
              <li>Encrypted storage for data at rest</li>
              <li>Access controls and authentication requirements</li>
              <li>Regular security audits and monitoring</li>
            </ul>
            <p className="text-[#A1A1A1] mt-4">
              While we implement strong security measures, no system is 100% secure. You are responsible for keeping your account password confidential.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Cookies & Analytics</h2>
            <p className="text-[#A1A1A1] mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li>Maintain your session and authentication state</li>
              <li>Analyze usage patterns (via PostHog or similar analytics tools)</li>
              <li>Improve service functionality</li>
            </ul>
            <p className="text-[#A1A1A1] mt-4">
              You can disable cookies through your browser settings, though this may affect service functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-[#A1A1A1] mb-4">
              We retain your personal data for as long as your account is active or as needed to provide services. 
              After account deletion, we may retain certain data for legal compliance or legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights (GDPR / CCPA)</h2>
            <p className="text-[#A1A1A1] mb-4">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#A1A1A1] ml-4">
              <li><strong className="text-white">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-white">Correction:</strong> Update or correct inaccurate information</li>
              <li><strong className="text-white">Deletion:</strong> Request deletion of your data</li>
              <li><strong className="text-white">Portability:</strong> Receive your data in a portable format</li>
              <li><strong className="text-white">Opt-Out:</strong> Opt out of certain data processing activities</li>
            </ul>
            <p className="text-[#A1A1A1] mt-4">
              To exercise these rights, contact us at <a href="mailto:privacy@riskmate.com" className="text-[#F97316] hover:underline">privacy@riskmate.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Children&apos;s Privacy</h2>
            <p className="text-[#A1A1A1]">
              RiskMate is not intended for users under 18 years of age. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
            <p className="text-[#A1A1A1]">
              We may update this Privacy Policy from time to time. We will notify you of changes by posting the new policy on this page 
              and updating the &quot;Last updated&quot; date. Continued use of RiskMate after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
            <p className="text-[#A1A1A1] mb-4">
              For questions about this Privacy Policy or to exercise your rights, contact us:
            </p>
            <p className="text-[#A1A1A1]">
              Email: <a href="mailto:privacy@riskmate.com" className="text-[#F97316] hover:underline">privacy@riskmate.com</a><br />
              Built in North America
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

