import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const rateLimitMap = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry && entry.reset > now) {
    if (entry.count >= MAX_PER_WINDOW) return new NextResponse(null, { status: 429 });
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, reset: now + WINDOW_MS });
  }
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) if (v.reset < now) rateLimitMap.delete(k);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (typeof body !== "object" || body === null) return new NextResponse(null, { status: 400 });
  const { message, url, digest } = body as Record<string, unknown>;
  console.error("[client-error]", {
    message: typeof message === "string" ? message.slice(0, 500) : undefined,
    url: typeof url === "string" ? url.slice(0, 200) : undefined,
    digest: typeof digest === "string" ? digest : undefined,
  });
  return new NextResponse(null, { status: 204 });
}
