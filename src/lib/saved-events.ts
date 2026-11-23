import { countries } from "./countries";
import { todayInCountry, type FestivalEvent } from "./events";
import type { Locale } from "./i18n";

// Must match the guard_saved_event() limit in 202611230001_saved_events.sql.
export const SAVED_EVENTS_LIMIT = 200;

// Shared links keep the sharer's language so link previews (og:locale, title)
// match what they saw; the recipient can still switch inside the modal.
export function eventShareUrl(origin: string, event: Pick<FestivalEvent, "id" | "countryCode">, locale: Locale) {
  const url = new URL(countries[event.countryCode || "kr"].path, origin);
  url.searchParams.set("event", event.id);
  url.searchParams.set("lang", locale);
  return url.href;
}

// An event without dates never counts as ended; otherwise compare its last
// day with today in the event's own country.
export function eventHasEnded(event: Pick<FestivalEvent, "startDate" | "endDate" | "countryCode">, today = todayInCountry(event.countryCode || "kr")) {
  const last = event.endDate || event.startDate;
  return !!last && last < today;
}
