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
  async rewrites() {
    return [
      {
        source: '/sample-risk-report.pdf',
        destination: '/api/sample-report',
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
  // Next.js 16: Add empty turbopack config to silence error (we use webpack)
  turbopack: {},
}

module.exports = nextConfig





