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
export function eventDate(event: Pick<FestivalEvent, "startDate" | "endDate">) {
  if (!event.startDate) return "일정 미정";
  const format = (date: string) => date.replaceAll("-", ".");
  return `${format(event.startDate)}${event.endDate && event.endDate !== event.startDate ? ` — ${format(event.endDate)}` : ""}`;
}
