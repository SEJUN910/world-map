// Directions links and "add to calendar" for the event detail.
// See .omc/plans/search-and-actions.md.
import type { CountryCode } from "./countries";

export type DirectionsLink = { service: "naver" | "kakao" | "google"; label: string; href: string };
type Place = { latitude: number; longitude: number; venue?: string; address?: string; title: string; countryCode?: CountryCode };

const placeName = (event: Place) => (event.venue?.trim() || event.address?.trim() || event.title.trim()).replace(/[,/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const coordinate = (value: number) => Number(value.toFixed(6));

/** Directions to the event's coordinates: Naver, Kakao and Google in Korea (Korean UI first), Google elsewhere. */
export function directionsLinks(event: Place, locale: string): DirectionsLink[] {
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) return [];
  const lat = coordinate(event.latitude), lng = coordinate(event.longitude);
  const name = encodeURIComponent(placeName(event));
  const google: DirectionsLink = { service: "google", label: "Google 지도", href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` };
  if ((event.countryCode || "kr") !== "kr") return [google];
  // Naver accepts WGS84 here (checked in a browser: desktop fills the destination, mobile hands it to its route search).
  const naver: DirectionsLink = { service: "naver", label: "네이버 지도", href: `https://map.naver.com/p/directions/-/${lng},${lat},${name},,/-/transit` };
  const kakao: DirectionsLink = { service: "kakao", label: "카카오맵", href: `https://map.kakao.com/link/to/${name},${lat},${lng}` };
  return locale === "ko" ? [naver, kakao, google] : [google, naver, kakao];
}

const DAY = 86_400_000;
const parse = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => iso(parse(date) + days * DAY);
export const LONG_EVENT_DAYS = 7;

export type CalendarPlan =
  | { kind: "none" }
  | { kind: "range"; start: string; end: string }
  | { kind: "pick"; min: string; max: string };

/**
 * What to add: nothing for undated, ended, cancelled or postponed events; the
 * remaining days (from today) when that is a week or less; otherwise one day
 * the visitor picks, so a six-month exhibition does not fill the calendar.
 */
export function calendarPlan(event: { startDate: string | null; endDate: string | null; eventStatus?: string | null }, today: string): CalendarPlan {
  if (!event.startDate || (event.eventStatus && event.eventStatus !== "scheduled")) return { kind: "none" };
  const last = event.endDate || event.startDate;
  if (![event.startDate, last, today].every((date) => Number.isFinite(parse(date)))) return { kind: "none" };
  if (last < today || last < event.startDate) return { kind: "none" };
  const first = event.startDate > today ? event.startDate : today;
  const days = Math.round((parse(last) - parse(first)) / DAY) + 1;
  return days <= LONG_EVENT_DAYS ? { kind: "range", start: first, end: last } : { kind: "pick", min: first, max: last };
}

type CalendarEvent = { id: string; title: string; venue?: string; address?: string; latitude: number; longitude: number; officialUrl?: string | null };
const compactDate = (date: string) => date.replace(/-/g, "");

/** All-day dates with an exclusive end, so they never shift with the viewer's time zone. */
export function googleCalendarUrl(event: CalendarEvent, start: string, end: string, details: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE", text: event.title,
    dates: `${compactDate(start)}/${compactDate(addDays(end, 1))}`,
    details, location: [event.venue, event.address].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
/** RFC 5545 folding: lines of at most 75 octets, never splitting a UTF-8 character. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "", size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > (parts.length ? 74 : 75)) { parts.push(current); current = ""; size = 0; }
    current += char; size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function icsFile(event: CalendarEvent, start: string, end: string, details: string, url: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const location = [event.venue, event.address].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Festiva//Event//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}-${compactDate(start)}@festiva`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(start)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(end, 1))}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    ...(Number.isFinite(event.latitude) && Number.isFinite(event.longitude) ? [`GEO:${coordinate(event.latitude)};${coordinate(event.longitude)}`] : []),
    `DESCRIPTION:${escapeText(details)}`,
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
