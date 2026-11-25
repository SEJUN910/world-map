import type { NextConfig } from "next";
import { buildCsp } from "./src/lib/csp";
import { RESIZABLE_POSTER_HOSTS } from "./src/lib/poster-hosts";

// headers() is evaluated at build time: changing MAP_TILE_URL or the Supabase URL needs a redeploy.
const csp = buildCsp({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, mapTileUrl: process.env.MAP_TILE_URL });

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
  // Small public posters for lists, markers and cards (src/lib/poster-image.ts).
  // One format, one quality and two widths keep the Vercel transformation count
  // low; 31 days because a changed source image arrives under a new URL.
  images: {
    remotePatterns: RESIZABLE_POSTER_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
    localPatterns: [{ pathname: "/assets/posters/**", search: "" }],
    formats: ["image/webp"],
    qualities: [70],
    imageSizes: [192],
    deviceSizes: [384],
    minimumCacheTTL: 2_678_400,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
export default config;
