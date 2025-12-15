/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/operations',
        permanent: true,
      },
      {
        source: '/dashboard/:path*',
        destination: '/operations/:path*',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/sample-risk-report.pdf',
        destination: '/api/sample-report',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/demo',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/og-image.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Include PDFKit font files in serverless bundle
      config.externals = config.externals || [];
      // Don't externalize pdfkit - we need it bundled
      config.externals = config.externals.filter(
        (external) => typeof external !== 'string' || !external.includes('pdfkit')
      );
    }
    return config;
  },
}

module.exports = nextConfig





