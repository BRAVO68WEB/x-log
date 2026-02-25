/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@xlog/ui", "@xlog/validation", "@xlog/types"],
  output: "standalone",
  async rewrites() {
    return [
      // ActivityPub federation endpoints
      {
        source: "/ap/:path*",
        destination: `${BACKEND_URL}/ap/:path*`,
      },
      // Well-known endpoints (WebFinger, NodeInfo)
      {
        source: "/.well-known/:path*",
        destination: `${BACKEND_URL}/.well-known/:path*`,
      },
      // NodeInfo endpoints
      {
        source: "/nodeinfo/:path*",
        destination: `${BACKEND_URL}/nodeinfo/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
