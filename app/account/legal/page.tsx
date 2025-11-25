'use client'

import Link from 'next/link'

const sections = [
  {
    title: '1. Purpose',
    body: [
      'RiskMate helps field crews identify, mitigate, and document jobsite risks. These terms govern how you access the platform and how we handle your data.',
    ],
  },
  {
    title: '2. Data Ownership',
    body: [
      'You retain ownership of all job records, photos, reports, and analytics generated through RiskMate. We store this data securely and never sell it to third parties.',
    ],
  },
  {
    title: '3. Acceptable Use',
    body: [
      'Do not upload unlawful content or use RiskMate to harass or mislead others.',
      'Keep login credentials secure. You are responsible for activity that occurs under your account.',
    ],
  },
  {
    title: '4. Compliance & Audit',
    body: [
      'RiskMate records an immutable audit trail for critical actions. This helps your organization meet OSHA, insurance, and contractual obligations.',
    ],
  },
  {
    title: '5. Privacy',
    body: [
      'We collect minimal personal data (name, email, organization) to operate the service.',
      'Photos and reports remain private to your organization unless you explicitly share them.',
    ],
  },
  {
    title: '6. Availability',
    body: [
      'RiskMate is provided “as is.” We strive for high uptime but may perform emergency maintenance without notice.',
    ],
  },
  {
    title: '7. Termination',
    body: [
      'You may terminate at any time. We may suspend accounts for repeated violations or unpaid invoices.',
    ],
  },
  {
    title: '8. Contact',
    body: [
      'Questions? Email compliance@riskmate.dev. We respond within two business days.',
    ],
  },
]

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#06070D] text-white">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-3xl font-semibold">RiskMate Terms &amp; Privacy</h1>
            <p className="text-sm text-[#9FA6BE]">Version 2025-12 • Effective December 1, 2025</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#9FA6BE] transition hover:border-white/30 hover:text-white"
          >
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-semibold text-white">{section.title}</h2>
            <div className="space-y-2 text-sm leading-relaxed text-[#C5CADB]">
              {section.body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-12 rounded-3xl border border-white/10 bg-[#0C0D16] p-6 text-sm text-[#9FA6BE]">
          <p>
            By continuing to use RiskMate, you agree to these terms. We may update this document
            periodically. If we make material changes, we will notify account owners via email
            and prompt for re-acceptance at login.
          </p>
        </footer>
      </main>
    </div>
  )
}

