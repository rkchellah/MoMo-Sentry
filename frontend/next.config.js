/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The booth agent screen is the default landing page.
      { source: '/', destination: '/agent', permanent: false },
    ]
  },
}

module.exports = nextConfig
