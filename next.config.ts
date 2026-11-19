import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "*.archive.org" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/my/:path*", destination: "/login", permanent: false },
      { source: "/profile/:path*", destination: "/settings/:path*", permanent: false },
      { source: "/huesound", destination: "/explore/huesound", permanent: true },
      { source: "/similar-users", destination: "/explore/similar-users", permanent: true },
    ];
  },
};

export default nextConfig;
