import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { publicClient } from "@/lib/event-repository";
import { publicTraffic } from "@/lib/traffic";

const loadTotals = unstable_cache(async (key: string) => {
  const { data, error } = await publicClient().rpc("traffic_totals", { p_key: key });
  const totals = error ? null : publicTraffic(data);
  if (!totals) throw new Error("Traffic totals unavailable");
  return totals;
}, ["public-traffic-totals"], { revalidate: 60 });

export async function GET() {
  const key = process.env.ANALYTICS_WRITE_KEY;
  try {
    if (!key) throw new Error("Traffic not configured");
    return NextResponse.json(await loadTotals(key), {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300", "X-Robots-Tag": "noindex" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
