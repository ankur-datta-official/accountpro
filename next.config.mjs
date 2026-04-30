/** @type {import('next').NextConfig} */
const baseConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
    ],
  },
  experimental: {
    workerThreads: true,
    webpackBuildWorker: false,
  },
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
}

const isDev = process.env.NODE_ENV !== "production"

const nextConfig = isDev
  ? {
      ...baseConfig,
      distDir: ".next-app",
    }
  : baseConfig

export default nextConfig
