import type { NextConfig } from "next";

// Headers that are the same on every response. The per-request Content
// Security Policy (with a nonce) is set in src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Browsers ignore HSTS on plain HTTP, so this only takes effect once served over HTTPS.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig: NextConfig = {
  // Every page is per-user and uses a per-request CSP nonce, so pages render
  // at request time. Cache Components' static shells can't carry a nonce.
  cacheComponents: false,
  poweredByHeader: false,
  // Native modules must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ["@node-rs/argon2", "better-sqlite3", "@prisma/adapter-better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
