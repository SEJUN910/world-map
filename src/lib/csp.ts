// Content-Security-Policy builder. Kept pure so it can be unit-tested and so
// next.config.ts only passes environment values in.
//
// MapLibre GL requires 'unsafe-eval' (GLSL shader compilation) and
// 'unsafe-inline' (dynamic style injection); Next also emits inline scripts.
// The MapLibre worker is loaded from the same origin ('self'), and blob: is
// kept for its fallback worker path.

const OSM_TILES = ["https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org"];
// Public poster sources allowed by events.source_image_url (see 202611100003_taiwan_events.sql).
const PUBLIC_POSTER_SOURCES = ["https://tong.visitkorea.or.kr", "https://*.gov.tw", "https://*.taiwan.net.tw"];
const SUPABASE_FALLBACK = ["https://*.supabase.co", "https://*.supabase.in"];

export type CspEnv = { supabaseUrl?: string; mapTileUrl?: string };

/** Returns the URL origin, or null for missing/invalid values. MAP_TILE_URL templates parse because `{z}` only appears in the path. */
export function originOf(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))];
}

export function buildCsp({ supabaseUrl, mapTileUrl }: CspEnv = {}): string {
  const supabase = originOf(supabaseUrl);
  const supabaseSources = supabase ? [supabase] : SUPABASE_FALLBACK;
  // map-config only accepts https tile URLs; ignore anything else here too.
  const tileOrigin = mapTileUrl?.trim().toLowerCase().startsWith("https://") ? originOf(mapTileUrl) : null;
  const imgSrc = unique(["'self'", "data:", "blob:", ...OSM_TILES, tileOrigin, ...supabaseSources, ...PUBLIC_POSTER_SOURCES]);
  const connectSrc = unique(["'self'", ...supabaseSources, ...OSM_TILES, tileOrigin]);
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
