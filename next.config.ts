import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // An isolated verification build does not overwrite the running dev server.
  distDir: process.env.FESTIVA_BUILD_DIR || ".next",
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
export default config;
