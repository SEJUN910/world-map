import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { analyticsInput, isLocalHost } from "@/lib/analytics";
import { publicClient } from "@/lib/event-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const limits = new Map<string, { expires: number; count: number }>();
export async function POST(request: NextRequest) {
  const host = request.headers.get("host") || new URL(request.url).host;
  let sameOrigin = false;
  try { sameOrigin = new URL(request.headers.get("origin") || "").host === host; } catch { /* Missing/invalid Origin */ }
  if (!sameOrigin) return new NextResponse(null, { status: 403, headers });
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1" || /bot|crawler|spider|headless|lighthouse|preview|slurp/i.test(request.headers.get("user-agent") || "")) return new NextResponse(null, { status: 204, headers });
  if ((isLocalHost(host) && process.env.ANALYTICS_INCLUDE_LOCAL !== "true") || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")) return new NextResponse(null, { status: 204, headers });
  const key = process.env.ANALYTICS_WRITE_KEY;
  if (!key) return new NextResponse(null, { status: 503, headers });
  if (Number(request.headers.get("content-length") || 0) > 1024) return new NextResponse(null, { status: 400, headers });
  let data: unknown;
  try { const body = await request.text(); if (body.length > 1024) throw Error(); data = JSON.parse(body); } catch { return new NextResponse(null, { status: 400, headers }); }
  const parsed = analyticsInput.safeParse(data);
  if (!parsed.success) return new NextResponse(null, { status: 400, headers });
  const hash = (value: string) => createHmac("sha256", key).update(value).digest("hex");
  // IP is used transiently for throttling only, never written to analytics.
  const ip = hash(`ip:${request.headers.get("x-forwarded-for")?.split(",")[0] || "local"}`);
  const now = Date.now();
  for (const [id, limit] of limits) if (limit.expires <= now) limits.delete(id);
  const limit = limits.get(ip) || { count: 0, expires: now + 60_000 };
  if (limit.count >= 120 || (limits.size >= 4096 && !limits.has(ip))) return new NextResponse(null, { status: 429, headers });
  limit.count++; limits.set(ip, limit);
  const validId = (name: string) => { const value = request.cookies.get(name)?.value; return value && /^[0-9a-f-]{36}$/i.test(value) ? value : randomUUID(); };
  const visitor = validId("festiva-visitor-stats"), session = validId("festiva-session-stats");
  const value = parsed.data;
  const { error } = await publicClient().rpc("record_analytics", { p_key: key, p_id: value.id, p_kind: value.kind, p_event_id: value.eventId, p_visitor: hash(`visitor:${visitor}`), p_session: hash(`session:${session}`), p_path: value.path, p_country: value.country, p_locale: value.locale, p_referrer: value.referrer });
  if (error) return new NextResponse(null, { status: 503, headers });
  const response = new NextResponse(null, { status: 204, headers });
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set("festiva-visitor-stats", visitor, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 365 });
  response.cookies.set("festiva-session-stats", session, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 30 * 60 });
  return response;
}
