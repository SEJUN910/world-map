// Abuse guard for /api/extract-poster, which spends a paid Anthropic quota.
// Pure so the 413/403/429 decisions can be unit-tested without a server.
// Limits live in instance memory: serverless instances count separately, so
// the global cap and the Anthropic console spend limit are the real backstop.

// Vercel rejects bodies over 4.5MB; the client sends at most ~4MB of base64 (drafts.ts).
export const MAX_POSTER_BODY_LENGTH = 4_200_000;
export const POSTER_LIMIT_PER_IP = 5;
export const POSTER_LIMIT_GLOBAL = 30;
const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 512;

export type PosterGuardResult = { ok: true } | { ok: false; status: 403 | 413 | 429 };

/** Same rule as /api/geocode: an Origin header, when present, must match the Host the browser used. */
export function sameOriginRequest(origin: string | null, host: string | null, requestUrl: string): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === (host || new URL(requestUrl).host);
  } catch {
    return false;
  }
}

export function createRateLimiter({ perIp = POSTER_LIMIT_PER_IP, global = POSTER_LIMIT_GLOBAL } = {}) {
  const limits = new Map<string, { expires: number; count: number }>();
  let globalLimit = { expires: 0, count: 0 };
  return function take(ip: string, now = Date.now()): boolean {
    for (const [address, limit] of limits) if (limit.expires <= now) limits.delete(address);
    if (globalLimit.expires <= now) globalLimit = { count: 0, expires: now + WINDOW_MS };
    const limit = limits.get(ip) || { count: 0, expires: now + WINDOW_MS };
    if (limit.count >= perIp || globalLimit.count >= global || (limits.size >= MAX_TRACKED_IPS && !limits.has(ip))) return false;
    limit.count++;
    globalLimit.count++;
    limits.set(ip, limit);
    return true;
  };
}

/** Checks run in the order the route documents: size (413) → origin (403) → rate (429). */
export function checkPosterRequest(
  input: { bodyLength: number; origin: string | null; host: string | null; url: string; ip: string },
  take: (ip: string) => boolean,
): PosterGuardResult {
  if (input.bodyLength > MAX_POSTER_BODY_LENGTH) return { ok: false, status: 413 };
  if (!sameOriginRequest(input.origin, input.host, input.url)) return { ok: false, status: 403 };
  if (!take(input.ip)) return { ok: false, status: 429 };
  return { ok: true };
}
