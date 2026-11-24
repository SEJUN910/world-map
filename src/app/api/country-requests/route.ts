import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { isLocalHost } from "@/lib/analytics";
import { isRequestableCountry } from "@/lib/requestable-countries";
import { publicClient } from "@/lib/event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const input = z.object({ countryCode: z.string().refine(isRequestableCountry) }).strict();
// Per-instance throttle by keyed IP hash; the IP itself is never stored.
const limits = new Map<string, { expires: number; count: number }>();
const PER_MINUTE = 10;
const COOKIE = "festiva-country-request";

export async function POST(request: NextRequest) {
  const host = request.headers.get("host") || new URL(request.url).host;
  let sameOrigin = false;
  try { sameOrigin = new URL(request.headers.get("origin") || "").host === host; } catch { /* Missing/invalid Origin */ }
  if (!sameOrigin) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (/bot|crawler|spider|headless|lighthouse|preview|slurp/i.test(request.headers.get("user-agent") || "")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (Number(request.headers.get("content-length") || 0) > 1024) return NextResponse.json({ error: "invalid" }, { status: 400, headers });
  let data: unknown;
  try { const body = await request.text(); if (body.length > 1024) throw Error(); data = JSON.parse(body); } catch { return NextResponse.json({ error: "invalid" }, { status: 400, headers }); }
  const parsed = input.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400, headers });
  // Local and preview builds share the production database; they answer without writing
  // so tests never count toward the real ranking.
  if (isLocalHost(host) || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")) return NextResponse.json({ status: "created", recorded: false }, { headers });
  const key = process.env.ANALYTICS_WRITE_KEY;
  if (!key) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  const hash = (value: string) => createHmac("sha256", key).update(value).digest("hex");
  const ip = hash(`country-request-ip:${request.headers.get("x-forwarded-for")?.split(",")[0] || "local"}`);
  const now = Date.now();
  for (const [id, limit] of limits) if (limit.expires <= now) limits.delete(id);
  // A full map drops its oldest entry rather than refusing every new address.
  if (limits.size >= 4096 && !limits.has(ip)) limits.delete(limits.keys().next().value!);
  const limit = limits.get(ip) || { count: 0, expires: now + 60_000 };
  if (limit.count >= PER_MINUTE) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
  limit.count++; limits.set(ip, limit);
  // Its own cookie and hash prefix, so requests cannot be joined to analytics history.
  const cookie = request.cookies.get(COOKIE)?.value;
  const visitor = cookie && /^[0-9a-f-]{36}$/i.test(cookie) ? cookie : randomUUID();
  // Daily-rotating network hash: the database caps new requests per network per day,
  // so dropping the cookie cannot stuff the ranking.
  const day = new Date().toISOString().slice(0, 10);
  const ipDay = hash(`country-request-ip-day:${day}:${request.headers.get("x-forwarded-for")?.split(",")[0] || "local"}`);
  const { data: result, error } = await publicClient().rpc("record_country_request", { p_key: key, p_visitor: hash(`country-request-visitor:${visitor}`), p_country: parsed.data.countryCode, p_ip_day: ipDay });
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  if (result === "limited") return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
  const response = NextResponse.json({ status: result === "created" ? "created" : "duplicate", recorded: true }, { headers });
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set(COOKIE, visitor, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
