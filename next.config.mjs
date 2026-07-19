/** @type {import('next').NextConfig} */
const baseConfig = {
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
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false
    }

    return config
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
