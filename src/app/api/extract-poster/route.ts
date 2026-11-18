import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
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
    console.error("[extract-poster] Claude API error", response.status);
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }

  const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = result.content?.find((b) => b.type === "text")?.text ?? "";
  let extracted: ExtractedFields = {};
  try {
    extracted = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
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
