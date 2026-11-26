import type { Metadata } from "next";
import { locales, type Locale } from "./i18n";
import { siteUrl, searchIndexingEnabled } from "./site";
import { countries } from "./countries";
import { eventDate, eventPath, type FestivalEvent } from "./events";
import type { CountryCode } from "./countries";

export function localizedPath(path: string, locale: Locale, values: Record<string, string | number | undefined> = {}) {
  const url = new URL(path, siteUrl);
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  url.searchParams.set("lang", locale);
  return `${url.pathname}${url.search}`;
}
export function absoluteUrl(path: string) { return new URL(path, siteUrl).href; }
export function localeAlternates(path: string, values: Record<string, string | number | undefined> = {}) {
  return Object.fromEntries([...locales.map((locale) => [locale, absoluteUrl(localizedPath(path, locale, values))]), ["x-default", absoluteUrl(localizedPath(path, "ko", values))]]);
}
// Next.js writes sitemap URLs into the XML as given, and our URLs carry "&" (?event=…&lang=…).
// An unescaped "&" makes the whole sitemap unreadable to search engines.
export function sitemapUrl(url: string) { return url.replace(/&(?!amp;)/g, "&amp;"); }
export function sitemapEntry(path: string, values: Record<string, string | number | undefined> = {}) {
  return { url: sitemapUrl(absoluteUrl(localizedPath(path, "ko", values))), alternates: { languages: Object.fromEntries(Object.entries(localeAlternates(path, values)).map(([language, url]) => [language, sitemapUrl(String(url))])) } };
}
// The brand is added to titles unless it is already there as a word ("Festivals in Korea" does not count).
const HAS_BRAND = /(^|[^a-z])festiva([^a-z]|$)/i;
export function pageMetadata({ title, description, path, locale, values = {}, noindex = false, image = "/og" }: {
  title: string; description: string; path: string; locale: Locale; values?: Record<string, string | number | undefined>; noindex?: boolean; image?: string;
}): Metadata {
  const url = absoluteUrl(localizedPath(path, locale, values));
  return { title: HAS_BRAND.test(title) ? { absolute: title } : title, description, alternates: { canonical: url, languages: localeAlternates(path, values) },
    robots: { index: searchIndexingEnabled && !noindex, follow: true, googleBot: { index: searchIndexingEnabled && !noindex, follow: true, "max-image-preview": "large" } },
    openGraph: { title: `${title} | festiva`, description, url, siteName: "festiva", type: "website", locale: locale === "ko" ? "ko_KR" : locale === "en" ? "en_US" : "zh_TW", images: [{ url: absoluteUrl(image), alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [absoluteUrl(image)] },
  };
}
// Page titles (translation keys) shared by the metadata and the page's <h1>.
export const COUNTRY_PAGE_TITLES = { kr: "한국의 축제와 동네 행사", tw: "대만의 축제와 행사", fr: "프랑스의 축제와 행사" } as const satisfies Record<CountryCode, string>;
export const REGION_PAGE_TITLE = "{region}의 축제와 행사";

/** Search snippet: when and where first ("2026.12.23 — 2026.12.25 · 청주한국공예관 · 충청북도"), then the description. */
export function eventDescription(event: FestivalEvent, max = 160) {
  const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
  const place = [...new Set([clean(event.venue), clean(event.region)].filter(Boolean))];
  const lead = [event.startDate ? eventDate(event) : "", ...place].filter(Boolean).join(" · ");
  const about = clean(event.description) || clean(event.address);
  const text = [lead, about].filter(Boolean).join(". ") || clean(event.title);
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}
export function eventStructuredData(event: FestivalEvent, locale: Locale) {
  if (!event.startDate || !event.address) return null;
  const url = absoluteUrl(localizedPath(eventPath(event), locale));
  return { "@context": "https://schema.org", "@type": "Event", "@id": `${url}#event`, name: event.title, description: event.description, url,
    startDate: event.startDate, ...(event.endDate ? { endDate: event.endDate } : {}),
    eventStatus: `https://schema.org/${event.eventStatus === "cancelled" ? "EventCancelled" : event.eventStatus === "postponed" ? "EventPostponed" : "EventScheduled"}`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: absoluteUrl(`/images/events/${event.id}`),
    location: { "@type": "Place", name: event.venue || event.address, address: { "@type": "PostalAddress", streetAddress: event.address || undefined, addressRegion: event.region || undefined, addressCountry: countries[event.countryCode || "kr"].iso }, geo: { "@type": "GeoCoordinates", latitude: event.latitude, longitude: event.longitude } },
  };
}
export function collectionStructuredData(title: string, path: string, events: FestivalEvent[], locale: Locale, page = 1, values: Record<string, string | number | undefined> = {}) {
  return { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: absoluteUrl(localizedPath(path, locale, { ...values, page: page > 1 ? page : undefined })),
    mainEntity: { "@type": "ItemList", itemListElement: events.map((event, index) => ({ "@type": "ListItem", position: (page - 1) * 24 + index + 1, name: event.title, url: absoluteUrl(localizedPath(eventPath(event), locale)) })) },
  };
}
export function breadcrumbData(country: keyof typeof countries, locale: Locale, region?: { name: string; path: string }) {
  const items = [{ name: "festiva", path: "/" }, { name: countries[country].english, path: countries[country].path }, ...(region ? [region] : [])];
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(localizedPath(item.path, locale)) })) };
}
export function serializeJsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029"); }
