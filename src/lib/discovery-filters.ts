import { todayInCountry } from "./events";
import type { CountryCode } from "./countries";
import { isEventCategory, type EventCategory } from "./event-categories";
import { isEventTag, type EventTag } from "./event-tags";
import { isEventTheme, themeClause, type EventTheme } from "./event-themes";

export type DateChoice = "all" | "today" | "weekend" | "month" | "custom";
// category "" means every category; tag narrows a chosen category and is "" without one;
// theme is a ready-made filter (src/lib/event-themes.ts) that works with or without a category.
export type DiscoveryFilters = { when: DateChoice; from: string; to: string; bounds: string; category: EventCategory | ""; tag: EventTag | ""; theme: EventTheme | "" };
export const emptyDiscoveryFilters: DiscoveryFilters = { when: "all", from: "", to: "", bounds: "", category: "", tag: "", theme: "" };
export type MapBounds = [number, number, number, number];
// List order. "latest" is the default and is never written to URLs.
export type EventSort = "latest" | "soon" | "ending";
export function normalizeSort(value: unknown): EventSort {
  return value === "soon" || value === "ending" ? value : "latest";
}
export type ExplorerView = "map" | "list";
export function normalizeView(value: unknown): ExplorerView {
  return value === "list" ? "list" : "map";
}
// Extra URL values for the list view and sort; both stay out of canonical URLs.
export function viewParams(view: ExplorerView, sort: EventSort) {
  return { ...(view === "list" ? { view } : {}), ...(sort !== "latest" ? { sort } : {}) };
}
export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function parseBounds(value: unknown): MapBounds | null {
  if (typeof value !== "string" || value.length > 100 || !/^-?[\d.]+,-?[\d.]+,-?[\d.]+,-?[\d.]+$/.test(value)) return null;
  const values = value.split(",").map(Number);
  const [west, south, east, north] = values;
  return values.every(Number.isFinite) && west >= -180 && east <= 180 && south >= -85 && north <= 85 && west < east && south < north ? values as MapBounds : null;
}
export function normalizeDiscoveryFilters(input: { when?: unknown; from?: unknown; to?: unknown; bounds?: unknown; category?: unknown; tag?: unknown; theme?: unknown }): DiscoveryFilters {
  let when: DateChoice = ["today", "weekend", "month", "custom"].includes(String(input.when)) ? input.when as DateChoice : "all";
  if (when === "custom" && (!validDate(input.from) || !validDate(input.to) || input.from > input.to)) when = "all";
  const bounds = parseBounds(input.bounds);
  return { when, from: when === "custom" ? String(input.from) : "", to: when === "custom" ? String(input.to) : "", bounds: bounds && parseBounds(bounds.map(n => Number(n.toFixed(5))).join(",")) ? bounds.map(n => Number(n.toFixed(5))).join(",") : "", category: isEventCategory(input.category) ? input.category : "", tag: isEventCategory(input.category) && isEventTag(input.tag) ? input.tag : "", theme: isEventTheme(input.theme) ? input.theme : "" };
}
export function discoveryDateRange(filters: DiscoveryFilters, country: CountryCode, today = todayInCountry(country)): { from: string; to: string } | null {
  if (filters.when === "all") return null;
  if (filters.when === "custom") return { from: filters.from, to: filters.to };
  if (filters.when === "today") return { from: today, to: today };
  const date = new Date(`${today}T00:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  if (filters.when === "weekend") {
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -1 : 6 - weekday));
    const from = iso(date); date.setUTCDate(date.getUTCDate() + 1);
    return { from, to: iso(date) };
  }
  return { from: today, to: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))) };
}
export function discoveryParams(filters: DiscoveryFilters) {
  return { ...(filters.when !== "all" ? { when: filters.when } : {}), ...(filters.when === "custom" ? { from: filters.from, to: filters.to } : {}), ...(filters.bounds ? { bounds: filters.bounds } : {}), ...(filters.category ? { category: filters.category } : {}), ...(filters.category && filters.tag ? { tag: filters.tag } : {}), ...(filters.theme ? { theme: filters.theme } : {}) };
}

// Both the paginated catalog and full marker query must apply the same filters.
export function applyDiscoveryFilters<T extends { lte(column: string, value: string | number): T; gte(column: string, value: string | number): T; or(value: string): T; eq(column: string, value: string): T; contains(column: string, value: string[]): T }>(request: T, filters: DiscoveryFilters, country: CountryCode): T {
  const range = discoveryDateRange(filters, country);
  if (range) request = request.lte("start_date", range.to).or(`end_date.gte.${range.from},and(end_date.is.null,start_date.gte.${range.from})`);
  const bounds = parseBounds(filters.bounds);
  if (bounds) request = request.gte("longitude", bounds[0]).lte("longitude", bounds[2]).gte("latitude", bounds[1]).lte("latitude", bounds[3]);
  if (isEventCategory(filters.category)) {
    request = request.eq("category", filters.category);
    if (isEventTag(filters.tag)) request = request.contains("tags", [filters.tag]);
  }
  if (isEventTheme(filters.theme)) request = request.or(themeClause(filters.theme));
  return request;
}
