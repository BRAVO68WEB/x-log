/** @type {import('next').NextConfig} */
const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@xlog/ui", "@xlog/validation", "@xlog/types"],
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
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
