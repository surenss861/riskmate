/** @type {import('next').NextConfig} */
// NOTE: /dashboard intentionally renamed to /operations
// for enterprise language consistency
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
      // Ensure PDFKit and its font data are bundled for serverless
      config.externals = config.externals || [];
      // Don't externalize pdfkit - we need it bundled with font data
      config.externals = config.externals.filter(
        (external) => typeof external !== 'string' || !external.includes('pdfkit')
      );
      
      // Add resolve fallback for font files (they're bundled in pdfkit)
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false, // PDFKit doesn't need fs in browser/serverless
      };
    }
    return config;
  },
}

module.exports = nextConfig





