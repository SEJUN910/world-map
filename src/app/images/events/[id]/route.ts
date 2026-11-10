import { NextResponse } from "next/server";
import { getPublicEvent } from "@/lib/event-repository";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const event = await getPublicEvent((await params).id);
  if (!event?.poster) return new NextResponse(null, { status: 404 });
  try { if (new URL(event.poster).protocol !== "https:") return new NextResponse(null, { status: 404 }); } catch { return new NextResponse(null, { status: 404 }); }
  return NextResponse.redirect(event.poster, { status: 302, headers: { "Cache-Control": "no-store" } });
}
