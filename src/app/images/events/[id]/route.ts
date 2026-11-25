import { NextResponse } from "next/server";
import { getPublicEvent } from "@/lib/event-repository";
import { LOCAL_POSTER_PATH } from "@/lib/poster-hosts";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const event = await getPublicEvent((await params).id);
  if (!event?.poster) return new NextResponse(null, { status: 404 });
  // A reduced copy on this site is stored as a path; everything else must be absolute https.
  const local = LOCAL_POSTER_PATH.test(event.poster);
  let target: URL;
  try { target = local ? new URL(event.poster, request.url) : new URL(event.poster); } catch { return new NextResponse(null, { status: 404 }); }
  if (!local && target.protocol !== "https:") return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
