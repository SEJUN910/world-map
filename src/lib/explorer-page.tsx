import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Explorer } from "@/components/explorer";
import { StructuredData } from "@/components/structured-data";
import { listEvents, listEventMapPoints, getRegions, getPublicEvent } from "./event-repository";
import { countries, type CountryCode } from "./countries";
import { todayInCountry } from "./events";
import { getLocale, getTranslations } from "./i18n/server";
import { breadcrumbData, collectionStructuredData, eventDescription, eventStructuredData, pageMetadata } from "./seo";
import { normalizeDiscoveryFilters, discoveryParams, normalizeSort, normalizeView, type EventSort } from "./discovery-filters";
import { countTags, selectVisibleTags, type EventTag } from "./event-tags";
export type ExplorerParams = { q?: string; region?: string; page?: string; event?: string; lang?: string; when?: string; from?: string; to?: string; bounds?: string; category?: string; tag?: string; view?: string; sort?: string };
function normalized(params: ExplorerParams) {
  const text = (value: unknown) => typeof value === "string" ? value.slice(0, 100) : "";
  return { region: text(params.region), query: text(params.q).trim(), page: Math.max(1, Math.min(10000, Math.floor(Number(params.page) || 1))), eventId: text(params.event), filters: normalizeDiscoveryFilters(params), view: normalizeView(params.view), sort: normalizeSort(params.sort) };
}
const load = cache(async (country: CountryCode, region: string, query: string, page: number, eventId: string, filterKey: string, sort: EventSort) => {
  const filters = normalizeDiscoveryFilters(JSON.parse(filterKey));
  if (eventId) {
    const event = await getPublicEvent(eventId);
    if (!event || event.countryCode !== country) notFound();
    return { result: { events: [event], total: 1 }, regions: [], mapPoints: [event], initialEvent: event, tagChips: [] as EventTag[] };
  }
  // Tag chips count the category's events under every filter except the tag
  // itself, so choosing one tag keeps the others. Without a tag that is the
  // marker query, so it is fetched once with tags and stripped.
  const tagScope = filters.category ? listEventMapPoints({ country, region, query, filters: { ...filters, tag: "" }, withTags: true }) : null;
  const [result, regions, points, tagged] = await Promise.all([
    listEvents({ country, region, query, page, filters, sort }), getRegions(country),
    tagScope && !filters.tag ? tagScope : listEventMapPoints({ country, region, query, filters }),
    tagScope,
  ]);
  if (page > 1 && !result.events.length) notFound();
  const tagChips = tagged ? selectVisibleTags(countTags(tagged), tagged.length, filters.tag) : [];
  const mapPoints = points.map(({ tags: _tags, ...point }) => point);
  return { result, regions, mapPoints, initialEvent: null, tagChips };
});
async function context(country: CountryCode, params: ExplorerParams, regionPath?: string) {
  const value = normalized(params);
  const [data, locale, t] = await Promise.all([load(country, value.region, value.query, value.page, value.eventId, JSON.stringify(value.filters), value.sort), getLocale(), getTranslations()]);
  const region = data.regions.find((item) => item.code === value.region);
  if (regionPath && !region) notFound();
  const path = !value.query && region && country === "kr" ? `/regions/${encodeURIComponent(region.code)}` : countries[country].path;
  const values = data.initialEvent ? { event: data.initialEvent.id } : { ...discoveryParams(value.filters), ...(value.region && path === countries[country].path ? { region: value.region } : {}), ...(value.page > 1 ? { page: value.page } : {}), ...(value.query ? { q: value.query } : {}) };
  const title = data.initialEvent?.title || (region ? t("{region}의 축제와 행사", { region: region.name }) : t(({ kr: "한국의 축제와 동네 행사", tw: "대만의 축제와 행사", fr: "프랑스의 축제와 행사" } as const)[country])) + (value.page > 1 ? ` · ${t("{page}페이지", { page: value.page })}` : "");
  const description = data.initialEvent ? eventDescription(data.initialEvent) : t("{place}의 축제와 행사를 지도에서 찾아보세요. 포스터, 일정, 장소와 행사 소개를 확인하고 가까운 행사를 발견하세요.", { place: region?.name || t(countries[country].name) });
  return { ...value, data, locale, t, region, path: data.initialEvent ? countries[country].path : path, values, title, description };
}
export async function explorerMetadata(country: CountryCode, params: ExplorerParams, regionPath?: string) {
  const ctx = await context(country, params, regionPath);
  const event = ctx.data.initialEvent;
  const expired = !!event?.endDate && event.endDate < todayInCountry(country);
  return pageMetadata({ title: ctx.title, description: ctx.description, path: ctx.path, locale: ctx.locale, values: ctx.values, noindex: event ? expired : ctx.view === "list" || ctx.sort !== "latest" || !!ctx.query || ctx.filters.when !== "all" || !!ctx.filters.bounds || !!ctx.filters.category || !!ctx.filters.tag || !ctx.data.result.total || (!!params.region && !ctx.region), image: event?.poster ? `/images/events/${event.id}` : "/og" });
}
export async function ExplorerPage({ country, params, regionPath }: { country: CountryCode; params: ExplorerParams; regionPath?: string }) {
  const ctx = await context(country, params, regionPath);
  const { data } = ctx;
  return <main id="main" className="country-entrance">
    <StructuredData value={data.initialEvent ? eventStructuredData(data.initialEvent, ctx.locale) : collectionStructuredData(ctx.title, ctx.path, data.result.events, ctx.locale, ctx.page, ctx.values)} />
    <StructuredData value={breadcrumbData(country, ctx.locale, ctx.region && ctx.path.startsWith("/regions/") ? { name: ctx.region.name, path: ctx.path } : undefined)} />
    <Explorer country={country} regions={data.regions} key={country} filters={ctx.filters} events={data.result.events} initialEvent={data.initialEvent} mapPoints={data.mapPoints} total={data.result.total} initialRegion={data.initialEvent ? "" : ctx.region?.code || params.region || ""} initialQuery={data.initialEvent ? "" : ctx.query} page={data.initialEvent ? 1 : ctx.page} initialView={data.initialEvent ? "map" : ctx.view} sort={data.initialEvent ? "latest" : ctx.sort} tagChips={data.tagChips} />
  </main>;
}
