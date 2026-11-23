import type { RichDocument } from "./rich-text";
import { countries, type CountryCode } from "./countries";

export type FestivalEvent = {
  countryCode?: CountryCode;
  id: string;
  slug: string;
  title: string;
  description: string;
  descriptionContent?: RichDocument | null;
  region: string;
  regionCode: string;
  venue: string;
  address: string;
  latitude: number;
  longitude: number;
  poster: string;
  startDate: string | null;
  endDate: string | null;
  officialUrl: string;
  isSample: boolean;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourceProvider?: string | null;
  sourceReferenceDate?: string | null;
  sourceImageLicense?: string | null;
  eventStatus?: string;
};
export function todayInCountry(country: CountryCode = "kr") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: countries[country].timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function todayInSeoul() { return todayInCountry("kr"); }
export function eventPath(event: Pick<FestivalEvent, "id" | "countryCode">) {
  return `${countries[event.countryCode || "kr"].path}?event=${encodeURIComponent(event.id)}`;
}
export function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
export function isEventId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export type EventBadge = { label: string; values?: Record<string, number>; tone: "live" | "closing" | "upcoming" | "ended" | "inactive" };
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
// Progress badge for list rows. `today` is the event country's local date.
export function eventBadge(event: Pick<FestivalEvent, "startDate" | "endDate" | "eventStatus">, today: string): EventBadge | null {
  if (event.eventStatus === "cancelled") return { label: "취소됨", tone: "inactive" };
  if (event.eventStatus === "postponed") return { label: "연기됨", tone: "inactive" };
  if (!event.startDate) return null;
  const last = event.endDate || event.startDate;
  if (last < today) return { label: "종료", tone: "ended" };
  if (event.startDate <= today) {
    if (last === today) return { label: "오늘 종료", tone: "closing" };
    return dayDiff(today, last) <= 3 ? { label: "종료 임박", tone: "closing" } : { label: "진행 중", tone: "live" };
  }
  const days = dayDiff(today, event.startDate);
  return days <= 14 ? { label: "D-{days}", values: { days }, tone: "upcoming" } : { label: "예정", tone: "upcoming" };
}
export function eventDate(event: Pick<FestivalEvent, "startDate" | "endDate">) {
  if (!event.startDate) return "일정 미정";
  const format = (date: string) => date.replaceAll("-", ".");
  return `${format(event.startDate)}${event.endDate && event.endDate !== event.startDate ? ` — ${format(event.endDate)}` : ""}`;
}
