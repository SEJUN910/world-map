import { NextRequest, NextResponse } from "next/server";
import { MAX_POSTER_BODY_LENGTH, checkPosterRequest, createRateLimiter } from "@/lib/poster-guard";

export const runtime = "nodejs";

export type ExtractedFields = {
  title?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
  description?: string;
};

const SYSTEM = `You are a festival/event poster reader. Extract information from the poster image and respond ONLY with a JSON object (no markdown, no explanation). Use this exact shape:
{"title":"...","startDate":"YYYY-MM-DD or null","endDate":"YYYY-MM-DD or null","venue":"...","description":"..."}
Rules:
- title: event name, Korean preferred if visible, max 100 chars
- startDate/endDate: ISO date string or null if not found
- venue: venue/place name only (not full address), max 120 chars, null if not found
- description: 1-2 sentence summary in Korean, max 300 chars
- If a field cannot be determined, use null
Respond only with the JSON object.`;

const DEFAULT_MODEL = "claude-haiku-5-5";
const UPSTREAM_TIMEOUT_MS = 15_000;
const takeRateLimit = createRateLimiter();

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // Reject declared oversize bodies before reading them; the text length check below covers chunked bodies.
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_POSTER_BODY_LENGTH) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let text: string;
  try {
    text = await request.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const guard = checkPosterRequest({
    bodyLength: text.length,
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    url: request.url,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
  }, takeRateLimit);
  if (!guard.ok) {
    const error = guard.status === 413 ? "too_large" : guard.status === 403 ? "forbidden" : "rate_limited";
    return NextResponse.json({ error }, { status: guard.status, headers: guard.status === 429 ? { "Retry-After": "60" } : undefined });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const { poster } = (body ?? {}) as Record<string, unknown>;
  if (typeof poster !== "string" || !poster.startsWith("data:image/")) {
    return new NextResponse(null, { status: 400 });
  }

  const match = poster.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return new NextResponse(null, { status: 400 });
  const [, mediaType, data] = match;

  const model = process.env.ANTHROPIC_POSTER_MODEL?.trim() || DEFAULT_MODEL;
  let result: { content?: Array<{ type: string; text?: string }> };
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              { type: "text", text: "Extract event information from this poster." },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      // Status and model ID are not secrets; they make a bad ANTHROPIC_POSTER_MODEL diagnosable.
      console.error("[extract-poster] Claude API error", { status: response.status, model });
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
    result = (await response.json()) as typeof result;
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[extract-poster] Claude API request failed", { reason: timedOut ? "timeout" : error instanceof Error ? error.name : "unknown", model });
    return NextResponse.json({ error: timedOut ? "upstream_timeout" : "upstream_error" }, { status: timedOut ? 504 : 502 });
  }

  const output = result.content?.find((b) => b.type === "text")?.text ?? "";
  let extracted: ExtractedFields = {};
  try {
    extracted = JSON.parse(output);
  } catch {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { extracted = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
    }
  }

  const clean: ExtractedFields = {};
  if (typeof extracted.title === "string" && extracted.title) clean.title = extracted.title.slice(0, 100);
  if (typeof extracted.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(extracted.startDate)) clean.startDate = extracted.startDate;
  if (typeof extracted.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(extracted.endDate)) clean.endDate = extracted.endDate;
  if (typeof extracted.venue === "string" && extracted.venue) clean.venue = extracted.venue.slice(0, 120);
  if (typeof extracted.description === "string" && extracted.description) clean.description = extracted.description.slice(0, 300);

  return NextResponse.json(clean);
}
