import type { NextConfig } from "next";

/**
 * connect-src 'self' makes the browser refuse any fetch, beacon or socket to another origin, so
 * the chip serial typed into the page cannot leave it even through injected code. Scripts and
 * styles are not restricted, because Next.js inlines both.
 */
const CONTENT_SECURITY_POLICY = [
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
