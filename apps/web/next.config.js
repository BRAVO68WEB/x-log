/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@xlog/ui", "@xlog/validation", "@xlog/types"],
};

module.exports = nextConfig;

