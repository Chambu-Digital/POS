/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode to prevent double-invocation of useEffect in
  // development, which causes duplicate API calls and Next.js link prefetches
  // to flood the terminal.  Strict Mode adds no value in production builds.
  reactStrictMode: false,
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
