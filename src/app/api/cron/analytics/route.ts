import { NextRequest, NextResponse } from "next/server";
import { publicClient } from "@/lib/event-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }
  const key = process.env.ANALYTICS_WRITE_KEY;
  if (!key) return NextResponse.json({ error: "No analytics key" }, { status: 503 });
  const { data, error } = await publicClient().rpc("purge_analytics_hits", { p_key: key, p_days: 90 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: data });
}
