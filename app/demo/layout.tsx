import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RiskMate Demo - See How Serious Contractors Document Risk',
  description: 'Interactive demo of RiskMate\'s compliance workflow. No signup required. See how contractors document risk with complete audit trails.',
  openGraph: {
    title: 'RiskMate Demo - See How Serious Contractors Document Risk',
    description: 'Interactive demo of RiskMate\'s compliance workflow. No signup required.',
    type: 'website',
    images: [
      {
        url: '/og-image.png', // Use same as marketing or create demo-specific
        width: 1200,
        height: 630,
        alt: 'RiskMate Demo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RiskMate Demo - See How Serious Contractors Document Risk',
    description: 'Interactive demo of RiskMate\'s compliance workflow. No signup required.',
  },
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

