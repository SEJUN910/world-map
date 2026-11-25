// Public poster hosts whose images may be resized by /_next/image. Used by
// next.config.ts (images.remotePatterns) and by posterSrc(), so the two agree.
// Not listed on purpose: tong.visitkorea.or.kr (KOGL Type 3, no alteration, so
// TourAPI images stay original) and Supabase (5-minute signed URLs would defeat
// the optimizer cache). See .omc/plans/poster-images.md.
export const RESIZABLE_POSTER_HOSTS = ["www.culture.go.kr", "cdn.paris.fr", "**.gov.tw", "**.taiwan.net.tw"] as const;

// Reduced copies of official images that are too large for the optimizer
// (Taiwan, OGDL-1.0 allows modification; see 202611250001_taiwan_local_poster.sql).
export const LOCAL_POSTER_PATH = /^\/assets\/posters\/Event_[A-Za-z0-9_]{1,80}\.jpg$/;

export function isResizablePoster(url: string): boolean {
  if (LOCAL_POSTER_PATH.test(url)) return true;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  return RESIZABLE_POSTER_HOSTS.some((pattern) =>
    pattern.startsWith("**.") ? host.endsWith(pattern.slice(2)) && host.length > pattern.length - 2 : host === pattern);
}
