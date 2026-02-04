import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Riskmate Demo - See How Serious Contractors Document Risk',
  description: 'Interactive demo of Riskmate\'s compliance workflow. No signup required. See how contractors document risk with complete audit trails.',
  openGraph: {
    title: 'Riskmate Demo - See How Serious Contractors Document Risk',
    description: 'Interactive demo of Riskmate\'s compliance workflow. No signup required.',
    type: 'website',
    images: [
      {
        url: '/og-image.png', // Use same as marketing or create demo-specific
        width: 1200,
        height: 630,
        alt: 'Riskmate Demo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Riskmate Demo - See How Serious Contractors Document Risk',
    description: 'Interactive demo of Riskmate\'s compliance workflow. No signup required.',
  },
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

