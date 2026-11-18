import type { NextConfig } from "next";

// MapLibre GL requires unsafe-eval (GLSL shader compilation) and unsafe-inline
// (dynamic style injection). worker-src blob: is needed for tile workers.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "*.supabase.co";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.supabase.co https://*.supabase.in",
  `connect-src 'self' https://${supabaseHost} https://api.geoapify.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://api.anthropic.com`,
  "worker-src blob:",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const config: NextConfig = {
  poweredByHeader: false,
  // An isolated verification build does not overwrite the running dev server.
  distDir: process.env.FESTIVA_BUILD_DIR || ".next",
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
export default config;
