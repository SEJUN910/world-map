// One category per event (list/map filter). Labels are translation keys.
export const EVENT_CATEGORIES = ["festival", "exhibition", "performance", "other"] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number];
export const CATEGORY_LABELS: Record<EventCategory, string> = { festival: "축제", exhibition: "전시", performance: "공연", other: "기타" };
export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && (EVENT_CATEGORIES as readonly string[]).includes(value);
}
