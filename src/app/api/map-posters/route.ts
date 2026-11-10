import { NextResponse } from "next/server";
import { isEventId } from "@/lib/events";
import { getMapPosterEvents } from "@/lib/event-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") || "").split(","))];
  const headers = { "Cache-Control": "no-store" };
  if (!ids.length || ids.length > 36 || !ids.every(isEventId)) {
    return NextResponse.json({ error: "Invalid event IDs" }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await getMapPosterEvents(ids), { headers });
  } catch {
    return NextResponse.json({ error: "Posters unavailable" }, { status: 503, headers });
  }
}
