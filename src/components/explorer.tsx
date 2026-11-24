"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "./language-provider";
import { localizedPath } from "@/lib/seo";
import { countries, type CountryCode } from "@/lib/countries";
import { todayInCountry, type FestivalEvent } from "@/lib/events";
import { discoveryParams, emptyDiscoveryFilters, normalizeView, validDate, viewParams, type DateChoice, type DiscoveryFilters, type EventSort, type ExplorerView, type MapBounds } from "@/lib/discovery-filters";
import { EventListItem } from "./event-list-item";
import { EventMap, type EventMapPoint, type MapFocusTarget } from "./event-map";
import { MinimalMasthead } from "./minimal-masthead";
import { LinkedEventDialog } from "./event-poster-dialog";
import { TrafficCounter } from "./traffic-counter";
import { SiteTools } from "./site-tools";
import { useMobileAtlas } from "./mobile-atlas-controls";
import { CountrySwitch } from "./country-switch";
const MobileEventSheet = dynamic(() => import("./mobile-event-sheet").then(module => module.MobileEventSheet), { ssr: false });

export function Explorer({ country = "kr", events, mapPoints, total, regions, initialRegion = "", initialQuery = "", page = 1, initialEvent = null, filters = emptyDiscoveryFilters, initialView = "map", sort = "latest" }: {
  country?: CountryCode; events: FestivalEvent[]; mapPoints: EventMapPoint[]; total: number;
  regions: { code: string; name: string }[]; initialRegion?: string; initialQuery?: string; page?: number;
  initialEvent?: FestivalEvent | null; filters?: DiscoveryFilters; initialView?: ExplorerView; sort?: EventSort;
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
  // Map or list. Switching only rewrites the URL (?view=list); the data is the same.
  const [view, setView] = useState<ExplorerView>(initialView);
  const viewRef = useRef(view); viewRef.current = view;
  const [focus, setFocus] = useState<MapFocusTarget | null>(null);
  // The URL is the source of truth: back/forward and replaceState both update it.
  const urlView = normalizeView(useSearchParams().get("view"));
  useEffect(() => { viewRef.current = urlView; setView(urlView); }, [urlView]);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => {
    setSelectedIds(null); setSelectedId(""); setViewportDirty(false); setFocus(null);
    listRef.current?.scrollTo({ top: 0 });
    setFrom(filters.from || todayInCountry(country)); setTo(filters.to || todayInCountry(country));
  }, [country, initialRegion, initialQuery, filters.when, filters.from, filters.to, filters.bounds, page]);
  const changeView = useCallback((next: ExplorerView) => {
    if (viewRef.current === next) return;
    viewRef.current = next;
    setView(next);
    // A focus target is used once; leaving the map must not replay it on return.
    if (next === "list") setFocus(null);
    const url = new URL(window.location.href);
    if (next === "list") url.searchParams.set("view", "list"); else url.searchParams.delete("view");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const showOnMap = useCallback((event: FestivalEvent) => {
    setSelectedIds(null); setSelectedId(event.id); setHighlightedId(event.id);
    setFocus({ latitude: event.latitude, longitude: event.longitude, nonce: Date.now() });
    changeView("map");
  }, [changeView]);
  // The mobile sheet renders in a portal on <body>; the floating view switch
  // there needs the sheet height too.
  const onHeight = useCallback((height: number) => {
    const value = `${Math.max(144, height)}px`;
    root.current?.style.setProperty("--mobile-sheet-height", value);
    document.documentElement.style.setProperty("--mobile-sheet-height", value);
  }, []);
  useEffect(() => () => { document.documentElement.style.removeProperty("--mobile-sheet-height"); }, []);
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
  function pathFor(region: string, text: string, nextFilters: DiscoveryFilters, targetPage = 1, nextSort: EventSort = sort) {
    const path = country === "kr" && region && !text.trim() ? `/regions/${encodeURIComponent(region)}` : countries[country].path;
    return localizedPath(path, locale, {
      ...discoveryParams(nextFilters), ...(text.trim() ? { q: text.trim() } : {}),
      ...(region && !path.startsWith("/regions/") ? { region } : {}), ...(targetPage > 1 ? { page: targetPage } : {}),
      ...viewParams(isMobile ? viewRef.current : "map", nextSort),
    });
  }
  function apply(region: string, text: string, nextFilters: DiscoveryFilters) {
    setSelectedIds(null); setSelectedId(""); setViewportDirty(false);
    startTransition(() => router.push(pathFor(region, text, nextFilters), { scroll: false }));
  }
  function applySort(next: EventSort) {
    setSelectedIds(null); setSelectedId("");
    startTransition(() => router.push(pathFor(initialRegion, initialQuery, filters, 1, next), { scroll: false }));
  }
  const pageHref = (nextPage: number) => pathFor(initialRegion, initialQuery, filters, nextPage);
  const options = [...regions];
  for (const event of events) if (event.region.trim() && !options.some(item => item.code === event.regionCode)) options.push({ code: event.regionCode, name: event.region });

  const searchForm = <form className="search-field country-search" onSubmit={event => { event.preventDefault(); apply(initialRegion, query, filters); }}>
    <input aria-label={t("행사명, 지역, 장소 검색")} placeholder={t("행사, 지역, 장소 검색")} type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
    <button type="submit" className="country-search-submit" disabled={pending} aria-label={t("검색")} title={t("검색")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    </button>
  </form>;
  const dateFilter = <div className="desktop-date-filter">
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
  </div>;
  const regionChips = <nav className="region-chips" aria-label={t("지역 필터")}>
    <Link href={pathFor("", initialQuery, { ...filters, bounds: "" })} className={!initialRegion ? "active" : ""} aria-current={!initialRegion ? "page" : undefined}>{t("전국")}</Link>
    {options.map(item => <Link key={item.code} href={pathFor(item.code, initialQuery, { ...filters, bounds: "" })} className={initialRegion === item.code ? "active" : ""} aria-current={initialRegion === item.code ? "page" : undefined}>{item.name}</Link>)}
  </nav>;
  const pages = Math.max(1, Math.ceil(total / 24));

  const sortSelect = <select className="list-view__sort" aria-label={t("정렬")} value={sort} disabled={pending} onChange={event => applySort(event.target.value as EventSort)}>
    <option value="latest">{t("최신 등록순")}</option><option value="soon">{t("일정 빠른 순")}</option><option value="ending">{t("종료 임박순")}</option>
  </select>;
  const searchAreaButton = viewportDirty && viewportBounds && <button type="button" className="atlas-search-area" disabled={pending} onClick={() => apply(initialRegion, initialQuery, { ...filters, bounds: viewportBounds.map(n => Number(n.toFixed(5))).join(",") })}>{t("이 지역에서 검색")}</button>;
  const panelLabel = t(catalogOpen ? "목록 접기" : "목록 펼치기");

  // Desktop: a list panel on the left and the map on the right, like a map app.
  // Mobile: full-screen map with the bottom sheet (snapped to the top = list view).
  // Both share one tree shape so the map is not remounted when the viewport
  // check flips to mobile after hydration (the server renders desktop).
  // ?view=list only matters on mobile; on desktop the list is always beside the map.
  return <div ref={root} className={isMobile ? "country-page country-page--atlas is-mobile-atlas has-event-sheet" : `country-page country-page--split${catalogOpen ? "" : " is-panel-closed"}`}>
    {initialEvent && <LinkedEventDialog key={initialEvent.id} event={initialEvent} />}
    {isMobile
      ? <MinimalMasthead back actions={<div className="atlas-mobile-actions atlas-mobile-country"><CountrySwitch country={country} heading={initialEvent ? "p" : "h1"} /></div>} />
      : <section id="atlas-catalog" className="split-panel" aria-label={t("행사 목록")} hidden={!catalogOpen}>
        <div className="split-panel__top">
          <MinimalMasthead back actions={<CountrySwitch country={country} heading={initialEvent ? "p" : "h1"} />} />
          {searchForm}
          <div className="split-panel__filters">{dateFilter}{sortSelect}</div>
        </div>
        <div className="split-panel__summary">
          <span>{t("총 {count}개", { count: total })}</span>
          {filters.bounds && <button type="button" className="list-view__chip" onClick={() => apply(initialRegion, initialQuery, { ...filters, bounds: "" })}>{t("현재 지도 영역")} <span aria-hidden="true">×</span><span className="visually-hidden">{t("영역 해제")}</span></button>}
        </div>
        <div ref={listRef} className="split-panel__list" aria-busy={pending}>
          {events.length
            ? <div className="split-panel__rows">{events.map(event => <EventListItem key={event.id} event={event} selected={selectedId === event.id} highlighted={highlightedId === event.id} onHover={handleCardHighlight} onShowOnMap={showOnMap} />)}</div>
            : <div className="empty-state"><span aria-hidden="true">✳</span><h2>{t("아직 발견하지 못했어요.")}</h2></div>}
          {(page > 1 || page * 24 < total) && <nav className="pagination" aria-label={t("행사 목록 페이지")}>
            {page > 1 && <Link className="button button-secondary" href={pageHref(page - 1)}>{t("← 이전")}</Link>}
            <span className="list-view__page">{t("{current} / {total} 페이지", { current: page, total: pages })}</span>
            {page * 24 < total && <Link className="button button-secondary" href={pageHref(page + 1)}>{t("다음 →")}</Link>}
          </nav>}
          <TrafficCounter inline />
        </div>
      </section>}
    <div className={isMobile ? "country-content" : "split-map"}>
      {!isMobile && <button type="button" className="split-panel-toggle" aria-controls="atlas-catalog" aria-expanded={catalogOpen} aria-label={panelLabel} title={panelLabel} onClick={() => setCatalogOpen(value => !value)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={catalogOpen ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
      {!isMobile && regionChips}
      <div className="country-split" aria-busy={pending}>
        <aside className="country-map" aria-label={t("지역 지도")}>
          {/* Fit once per region page; a bounds search must not rebuild the map and lose the user's viewport. */}
          <EventMap country={country} points={mapPoints} fitToPoints={!!initialRegion}
            onSelectEvents={isMobile ? selectMapEvents : undefined} selectedEventId={selectedId} onViewportChange={onViewportChange} focusTarget={focus}
            onEventHighlight={isMobile ? undefined : handleMapHighlight} highlightedId={isMobile ? undefined : highlightedId} />
          {searchAreaButton}
          {total > mapPoints.length && <p className="map-help">{t("지도에는 최대 5,000개의 행사만 표시돼요.")}</p>}
        </aside>
      </div>
    </div>
    {isMobile ? <>
      <MobileEventSheet country={country} events={events} total={total} page={page} regions={options} region={initialRegion} query={initialQuery} filters={filters} pending={pending}
        selectedIds={selectedIds} selectedId={selectedId} onSelect={setSelectedId} onSelectionClear={() => { setSelectedIds(null); setSelectedId(""); }}
        onApply={apply} pageHref={pageHref} onHeight={onHeight}
        view={view} onViewChange={changeView} sort={sort} onSort={applySort} onShowOnMap={showOnMap} />
      {createPortal(<button type="button" className={`atlas-view-switch${view === "list" ? " is-list" : ""}`} onClick={() => changeView(view === "list" ? "map" : "list")}>
        {view === "list"
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
        <span>{t(view === "list" ? "지도보기" : "목록보기")}</span>
      </button>, document.body)}
    </> : <SiteTools atlas />}
  </div>;
}
