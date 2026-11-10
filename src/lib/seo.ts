import type { Metadata } from "next";
import { locales, type Locale } from "./i18n";
import { siteUrl, searchIndexingEnabled } from "./site";
import { countries } from "./countries";
import { eventPath, type FestivalEvent } from "./events";

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
export function pageMetadata({ title, description, path, locale, values = {}, noindex = false, image = "/og" }: {
  title: string; description: string; path: string; locale: Locale; values?: Record<string, string | number | undefined>; noindex?: boolean; image?: string;
}): Metadata {
  const url = absoluteUrl(localizedPath(path, locale, values));
  return { title: title.toLowerCase().includes("festiva") ? { absolute: title } : title, description, alternates: { canonical: url, languages: localeAlternates(path, values) },
    robots: { index: searchIndexingEnabled && !noindex, follow: true, googleBot: { index: searchIndexingEnabled && !noindex, follow: true, "max-image-preview": "large" } },
    openGraph: { title: `${title} | festiva`, description, url, siteName: "festiva", type: "website", locale: locale === "ko" ? "ko_KR" : locale === "en" ? "en_US" : "zh_TW", images: [{ url: absoluteUrl(image), alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [absoluteUrl(image)] },
  };
}
export function eventDescription(event: FestivalEvent) {
  return (event.description || [event.title, event.region, event.venue, event.address].filter(Boolean).join(" · ")).replace(/\s+/g, " ").trim().slice(0, 180);
}
export function eventStructuredData(event: FestivalEvent, locale: Locale) {
  if (!event.startDate || !event.address) return null;
  const url = absoluteUrl(localizedPath(eventPath(event), locale));
  return { "@context": "https://schema.org", "@type": "Event", "@id": `${url}#event`, name: event.title, description: event.description, url,
    startDate: event.startDate, ...(event.endDate ? { endDate: event.endDate } : {}),
    eventStatus: `https://schema.org/${event.eventStatus === "cancelled" ? "EventCancelled" : event.eventStatus === "postponed" ? "EventPostponed" : "EventScheduled"}`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: absoluteUrl(`/images/events/${event.id}`),
    location: { "@type": "Place", name: event.venue || event.address, address: { "@type": "PostalAddress", streetAddress: event.address || undefined, addressRegion: event.region || undefined, addressCountry: event.countryCode === "tw" ? "TW" : "KR" }, geo: { "@type": "GeoCoordinates", latitude: event.latitude, longitude: event.longitude } },
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
