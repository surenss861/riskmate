import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '700', '900']
})

export const metadata: Metadata = {
  title: 'RiskMate - Protect Every Job Before It Starts',
  description: 'Instant risk scoring, auto-mitigation checklists, and shareable PDF reports for service contractors. Built for speed, not bureaucracy.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/favicon.svg' }],
    shortcut: ['/favicon.svg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable} ${inter.className}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml" />
        {/* PostHog Analytics */}
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var o=e;i.forEach(function(t){o=t[o]?"object"==typeof o[t]?o[t]:[]:o[t]=[]}),o.__SV=1}(e,o,t))}(document,window.posthog||[]);
                  posthog.init('${process.env.NEXT_PUBLIC_POSTHOG_KEY}',{api_host:'${process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'}'})
                `,
              }}
            />
          </>
        )}
        {/* StringTune Library - Load from unpkg CDN or local */}
        <script
          src={process.env.NEXT_PUBLIC_STRING_TUNE_URL || 'https://unpkg.com/@fiddle-digital/string-tune@1.1.29/dist/index.js'}
          defer
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
