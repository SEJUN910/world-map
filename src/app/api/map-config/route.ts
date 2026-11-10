import { NextResponse } from "next/server";

// Keep the tile endpoint configurable at runtime, including after deployment.
export const dynamic = "force-dynamic";
export function GET() {
  const customUrl = process.env.MAP_TILE_URL?.trim();
  const customAttribution = process.env.MAP_TILE_ATTRIBUTION?.trim();
  if (customUrl && (!customAttribution || !/^https:\/\//i.test(customUrl) || !["{z}", "{x}", "{y}"].every((part) => customUrl.includes(part)))) {
    return NextResponse.json({ error: "Invalid map configuration" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({
    tiles: customUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: customUrl ? customAttribution : "© OpenStreetMap contributors",
    openStreetMap: !customUrl,
  }, { headers: { "Cache-Control": "no-store" } });
}
