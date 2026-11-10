export type TrafficTotals = { todayVisitors: number; pageViews: number; eventViews: number };
// Project only the public counters, even if the upstream RPC ever grows.
export function publicTraffic(value: unknown): TrafficTotals | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const valid = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (!valid(row.todayVisitors) || !valid(row.pageViews) || !valid(row.eventViews)) return null;
  return { todayVisitors: row.todayVisitors, pageViews: row.pageViews, eventViews: row.eventViews };
}
