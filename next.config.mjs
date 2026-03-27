/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fecy.co.ke',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
