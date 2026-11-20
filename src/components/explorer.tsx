"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "./language-provider";
import { localizedPath } from "@/lib/seo";
import { countries, type CountryCode } from "@/lib/countries";
import { todayInCountry, type FestivalEvent } from "@/lib/events";
import { discoveryParams, emptyDiscoveryFilters, validDate, type DateChoice, type DiscoveryFilters, type MapBounds } from "@/lib/discovery-filters";
import { EventCard } from "./event-card";
import { EventMap, type EventMapPoint } from "./event-map";
import { MinimalMasthead } from "./minimal-masthead";
import { LinkedEventDialog } from "./event-poster-dialog";
import { TrafficCounter } from "./traffic-counter";
import { SiteTools } from "./site-tools";
import { useMobileAtlas } from "./mobile-atlas-controls";
import { CountrySwitch } from "./country-switch";
const MobileEventSheet = dynamic(() => import("./mobile-event-sheet").then(module => module.MobileEventSheet), { ssr: false });

export function Explorer({ country = "kr", events, mapPoints, total, regions, initialRegion = "", initialQuery = "", page = 1, initialEvent = null, filters = emptyDiscoveryFilters }: {
  country?: CountryCode; events: FestivalEvent[]; mapPoints: EventMapPoint[]; total: number;
  regions: { code: string; name: string }[]; initialRegion?: string; initialQuery?: string; page?: number;
  initialEvent?: FestivalEvent | null; filters?: DiscoveryFilters;
}) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const isMobile = useMobileAtlas();
  const root = useRef<HTMLDivElement>(null);
  const latestPoints = useRef(mapPoints); latestPoints.current = mapPoints;
  const [query, setQuery] = useState(initialQuery);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Hovering a list card only highlights; scrolling the list there would make it jump under the cursor.
  function handleCardHighlight(id: string | null) {
    setHighlightedId(id);
  }
  // Hovering a map marker highlights its card and brings it into view.
  function handleMapHighlight(id: string | null) {
    setHighlightedId(id);
    if (id) {
      const card = listRef.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`);
      card?.scrollIntoView({ behavior: "instant", block: "nearest" });
    }
  }
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [viewportBounds, setViewportBounds] = useState<MapBounds | null>(null);
  const [viewportDirty, setViewportDirty] = useState(false);
  const [customDates, setCustomDates] = useState(false);
  const [from, setFrom] = useState(filters.from || todayInCountry(country));
  const [to, setTo] = useState(filters.to || todayInCountry(country));
  const [dateError, setDateError] = useState(false);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => {
    setSelectedIds(null); setSelectedId(""); setViewportDirty(false);
    setFrom(filters.from || todayInCountry(country)); setTo(filters.to || todayInCountry(country));
  }, [country, initialRegion, initialQuery, filters.when, filters.from, filters.to, filters.bounds, page]);
  const onHeight = useCallback((height: number) => root.current?.style.setProperty("--mobile-sheet-height", `${Math.max(144, height)}px`), []);
  const selectMapEvents = useCallback((ids: string[]) => {
    const allowed = new Set(latestPoints.current.map(point => point.id));
    const next = [...new Set(ids)].filter(id => allowed.has(id));
    if (!next.length) return;
    setSelectedIds(next); setSelectedId(next[0]);
  }, []);
  const onViewportChange = useCallback((bounds: MapBounds, userChanged: boolean) => {
    setViewportBounds(bounds);
    if (userChanged) setViewportDirty(true);
  }, []);
  function pathFor(region: string, text: string, nextFilters: DiscoveryFilters, targetPage = 1) {
    const path = country === "kr" && region && !text.trim() ? `/regions/${encodeURIComponent(region)}` : countries[country].path;
    return localizedPath(path, locale, {
      ...discoveryParams(nextFilters), ...(text.trim() ? { q: text.trim() } : {}),
      ...(region && !path.startsWith("/regions/") ? { region } : {}), ...(targetPage > 1 ? { page: targetPage } : {}),
    });
  }
  function apply(region: string, text: string, nextFilters: DiscoveryFilters) {
    setSelectedIds(null); setSelectedId(""); setViewportDirty(false);
    startTransition(() => router.push(pathFor(region, text, nextFilters), { scroll: false }));
  }
  const pageHref = (nextPage: number) => pathFor(initialRegion, initialQuery, filters, nextPage);
  const options = [...regions];
  for (const event of events) if (event.region.trim() && !options.some(item => item.code === event.regionCode)) options.push({ code: event.regionCode, name: event.region });

  return <div ref={root} className={`country-page country-page--atlas${isMobile ? " is-mobile-atlas has-event-sheet" : ""}${!catalogOpen && !isMobile ? " is-catalog-hidden" : ""}`}>
    <MinimalMasthead back actions={isMobile ? <div className="atlas-mobile-actions atlas-mobile-country"><CountrySwitch country={country} heading={initialEvent ? "p" : "h1"} /></div> : undefined} />
    {initialEvent && <LinkedEventDialog key={initialEvent.id} event={initialEvent} />}
    {!isMobile && <div className="atlas-desktop-controls">
      <SiteTools atlas catalogOpen={catalogOpen} onToggleCatalog={() => setCatalogOpen(value => !value)} />
      <form className="search-field country-search" onSubmit={event => { event.preventDefault(); apply(initialRegion, query, filters); }}>
        <input aria-label={t("행사명, 지역, 장소 검색")} placeholder={t("행사, 지역, 장소 검색")} type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
        <button type="submit" className="country-search-submit" disabled={pending} aria-label={t("검색")} title={t("검색")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </form>
      <div className="desktop-date-filter">
        <select aria-label={t("기간 필터")} value={customDates ? "custom" : filters.when} disabled={pending} onChange={event => {
          const when = event.target.value as DateChoice;
          setCustomDates(when === "custom");
          if (when !== "custom") apply(initialRegion, initialQuery, { ...filters, when, from: "", to: "" });
        }}>
          <option value="all">{t("기간 전체")}</option><option value="today">{t("오늘")}</option><option value="weekend">{t("이번 주말")}</option><option value="month">{t("이번 달")}</option><option value="custom">{t("기간 선택")}</option>
        </select>
        {customDates && <form onSubmit={event => {
          event.preventDefault();
          if (!validDate(from) || !validDate(to) || from > to) { setDateError(true); return; }
          setDateError(false); setCustomDates(false); apply(initialRegion, initialQuery, { ...filters, when: "custom", from, to });
        }}>
          <input type="date" aria-label={t("시작일")} value={from} onChange={event => setFrom(event.target.value)} required />
          <input type="date" aria-label={t("종료일")} value={to} min={from} onChange={event => setTo(event.target.value)} required />
          <button type="submit">{t("적용")}</button>{dateError && <p role="alert">{t("시작일과 종료일을 확인해주세요.")}</p>}
        </form>}
      </div>
    </div>}
    <div className="country-content">
      {!isMobile && <>
        <nav className="region-chips" aria-label={t("지역 필터")}>
          <Link href={pathFor("", initialQuery, { ...filters, bounds: "" })} className={!initialRegion ? "active" : ""} aria-current={!initialRegion ? "page" : undefined}>{t("전국")}</Link>
          {options.map(item => <Link key={item.code} href={pathFor(item.code, initialQuery, { ...filters, bounds: "" })} className={initialRegion === item.code ? "active" : ""} aria-current={initialRegion === item.code ? "page" : undefined}>{item.name}</Link>)}
        </nav>
        <div className="country-heading"><p className="eyebrow">{countries[country].english}</p><CountrySwitch country={country} heading={initialEvent ? "p" : "h1"}/><TrafficCounter inline /></div>
      </>}
      <div className="country-split" aria-busy={pending}>
        <aside className="country-map" aria-label={t("지역 지도")}>
          <EventMap country={country} points={mapPoints} fitToPoints={!!initialRegion && !filters.bounds}
            onSelectEvents={isMobile ? selectMapEvents : undefined} selectedEventId={selectedId} onViewportChange={isMobile ? onViewportChange : undefined}
            onEventHighlight={isMobile ? undefined : handleMapHighlight} highlightedId={isMobile ? undefined : highlightedId} />
          {isMobile && viewportDirty && viewportBounds && <button type="button" className="atlas-search-area" disabled={pending} onClick={() => apply(initialRegion, initialQuery, { ...filters, bounds: viewportBounds.map(n => Number(n.toFixed(5))).join(",") })}>{t("이 지역에서 검색")}</button>}
          {total > mapPoints.length && <p className="map-help">{t("지도에는 최대 5,000개의 행사만 표시돼요.")}</p>}
        </aside>
        {!isMobile && <section id="atlas-catalog" className="country-results" aria-label={t("행사 목록")} hidden={!catalogOpen}>
          {events.length ? <div ref={listRef} className="event-grid explorer-grid">{events.map(event => <EventCard key={event.id} event={event} highlighted={highlightedId === event.id} onHover={handleCardHighlight} />)}</div> : <div className="empty-state"><span aria-hidden="true">✳</span><h2>{t("아직 발견하지 못했어요.")}</h2></div>}
          {(page > 1 || page * 24 < total) && <nav className="pagination" aria-label={t("행사 목록 페이지")}>
            {page > 1 && <Link className="button button-secondary" href={pageHref(page - 1)}>{t("← 이전")}</Link>}
            {page * 24 < total && <Link className="button button-secondary" href={pageHref(page + 1)}>{t("다음 →")}</Link>}
          </nav>}
        </section>}
      </div>
    </div>
    {isMobile && <MobileEventSheet country={country} events={events} total={total} page={page} regions={options} region={initialRegion} query={initialQuery} filters={filters} pending={pending}
      selectedIds={selectedIds} selectedId={selectedId} onSelect={setSelectedId} onSelectionClear={() => { setSelectedIds(null); setSelectedId(""); }}
      onApply={apply} pageHref={pageHref} onHeight={onHeight} />}
  </div>;
}
