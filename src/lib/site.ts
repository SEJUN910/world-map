export function resolveSiteUrl(configured?: string, productionDomain?: string) {
  for (const value of [configured, productionDomain ? `https://${productionDomain}` : undefined]) {
    if (!value) continue;
    try { const url = new URL(value); if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) return url.origin; } catch { /* Try production fallback */ }
  }
  return "http://localhost:3000";
}
export const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL);
export const searchIndexingEnabled = !siteUrl.startsWith("http://localhost") && process.env.VERCEL_ENV !== "preview";
