/** @type {import('next').NextConfig} */
// NOTE: /dashboard intentionally renamed to /operations
// for enterprise language consistency
const nextConfig = {
  reactStrictMode: true,
  
  // Externalize PDFKit to prevent bundling issues with font metric files
  // PDFKit expects its AFM files to be in node_modules/pdfkit/js/data/
  // When bundled, these paths break in serverless environments
  serverExternalPackages: ['pdfkit'],

  // Note: We're using assets/pdfkit/ directory with PDFKIT_DATA_DIR env var
  // instead of outputFileTracingIncludes to avoid Vercel deployment issues

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
  // Removed webpack PDFKit bundling config - now using serverExternalPackages
  // to keep PDFKit external so it can resolve fonts from node_modules/pdfkit/js/data/
}

module.exports = nextConfig





