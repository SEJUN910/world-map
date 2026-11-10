import { isCountryCode } from "@/lib/countries";
import { NextResponse } from "next/server";
import { addressResults } from "@/lib/geocoding";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const cache = new Map<string, { expires: number; results: ReturnType<typeof addressResults> }>();
const limits = new Map<string, { expires: number; count: number }>();
let globalLimit = { expires: 0, count: 0 };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // Next may normalize request.url to localhost behind its HTTP server/proxy.
  // The Host header retains the origin used by the browser.
  if (origin) {
    let sameHost = false;
    try { sameHost = new URL(origin).host === (request.headers.get("host") || new URL(request.url).host); } catch { /* Invalid Origin */ }
    if (!sameHost) return NextResponse.json({ error: "허용되지 않은 요청이에요." }, { status: 403, headers });
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) throw new Error();
    body = JSON.parse(text);
  } catch { return NextResponse.json({ error: "주소를 확인해주세요." }, { status: 400, headers }); }
  const value = body as { text?: unknown; country?: unknown } | null;
  const query = typeof value?.text === "string" ? value.text.trim().replace(/\s+/g, " ") : "";
  if (query.length < 3 || query.length > 200 || !isCountryCode(value?.country)) return NextResponse.json({ error: "주소를 3~200자로 입력해주세요." }, { status: 400, headers });
  const country = value!.country as "kr" | "tw";
  const cacheKey = `${country}:${query}`;
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "주소 검색이 아직 연결되지 않았어요. 위치 직접 지정하기를 이용해주세요." }, { status: 503, headers });

  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  for (const [address, limit] of limits) if (limit.expires <= now) limits.delete(address);
  const limit = limits.get(ip) || { count: 0, expires: now + 60_000 };
  if (globalLimit.expires <= now) globalLimit = { count: 0, expires: now + 60_000 };
  if (limit.count >= 12 || globalLimit.count >= 120 || (limits.size >= 512 && !limits.has(ip))) {
    return NextResponse.json({ error: "검색이 많아요. 잠시 후 다시 시도해주세요." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  }
  limit.count++;
  globalLimit.count++;
  limits.set(ip, limit);
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > now) return NextResponse.json({ results: cached.results }, { headers });

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.search = new URLSearchParams({ text: query, filter: `countrycode:${country}`, lang: country === "kr" ? "ko" : "en", limit: "5", format: "json", apiKey: key }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) throw new Error();
    const results = addressResults(await response.json(), country);
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { expires: now + 3_600_000, results });
    return NextResponse.json({ results }, { headers });
  } catch {
    // Never expose provider responses, URLs or the server-side API key.
    return NextResponse.json({ error: "주소 검색을 완료하지 못했어요. 잠시 후 다시 검색하거나 위치를 직접 지정해주세요." }, { status: 502, headers });
  }
}
