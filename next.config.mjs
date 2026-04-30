/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: ".next-app",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    workerThreads: true,
    webpackBuildWorker: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
