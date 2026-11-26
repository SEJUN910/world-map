"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "./language-provider";
import { COUNTRY_PAGE_TITLES, localizedPath, REGION_PAGE_TITLE } from "@/lib/seo";
import { countries, type CountryCode } from "@/lib/countries";
import { todayInCountry, type FestivalEvent } from "@/lib/events";
import { discoveryParams, emptyDiscoveryFilters, normalizeView, validDate, viewParams, type DateChoice, type DiscoveryFilters, type EventSort, type ExplorerView, type MapBounds } from "@/lib/discovery-filters";
import { EventListItem } from "./event-list-item";
import { EventMap, type EventMapPoint, type MapFocusTarget } from "./event-map";
import { MinimalMasthead } from "./minimal-masthead";
import { LinkedEventDialog } from "./event-poster-dialog";
import { TrafficCounter } from "./traffic-counter";
import { SiteTools } from "./site-tools";
import { MobileMenu } from "./mobile-menu";
import { QuickChips } from "./quick-chips";
import { EventCreateButton } from "./event-create-button";
import { useMobileAtlas } from "./mobile-atlas-controls";
import { CountrySwitch } from "./country-switch";
import { SourceNotice } from "./source-notice";
import { CategoryChips } from "./category-chips";
import { TagChips } from "./tag-chips";
import { useGroupEvents } from "./use-group-events";
import type { EventTag } from "@/lib/event-tags";
import { APPROXIMATE_METERS, NO_DISTANCE_METERS, countryAt, formatDistance, handOffPosition, nearbyEvents, takeHandedOffPosition, zoomForAccuracy, type Position } from "@/lib/nearby";
const MobileEventSheet = dynamic(() => import("./mobile-event-sheet").then(module => module.MobileEventSheet), { ssr: false });

export function Explorer({ country = "kr", events, mapPoints, total, regions, initialRegion = "", initialQuery = "", page = 1, initialEvent = null, filters = emptyDiscoveryFilters, initialView = "map", sort = "latest", tagChips = [], featured = [] }: {
  country?: CountryCode; events: FestivalEvent[]; mapPoints: EventMapPoint[]; total: number;
  regions: { code: string; name: string }[]; initialRegion?: string; initialQuery?: string; page?: number;
  initialEvent?: FestivalEvent | null; filters?: DiscoveryFilters; initialView?: ExplorerView; sort?: EventSort; tagChips?: EventTag[]; featured?: FestivalEvent[];
}) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const isMobile = useMobileAtlas();
  const root = useRef<HTMLDivElement>(null);
  const createOpener = useRef<HTMLSpanElement>(null);
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
  }, [country, initialRegion, initialQuery, filters.when, filters.from, filters.to, filters.bounds, filters.category, filters.tag, filters.theme, page]);
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
  // Desktop keeps a map selection in the list while flying to one of its events.
  const showOnMap = useCallback((event: FestivalEvent) => {
    if (isMobile) setSelectedIds(null);
    setSelectedId(event.id); setHighlightedId(event.id);
    setFocus({ latitude: event.latitude, longitude: event.longitude, nonce: Date.now() });
    changeView("map");
  }, [changeView, isMobile]);
  // The mobile sheet renders in a portal on <body>; the floating view switch
  // there needs the sheet height too.
  const onHeight = useCallback((height: number) => {
    const value = `${Math.max(76, height)}px`;
    root.current?.classList.toggle("is-sheet-tall", height > window.innerHeight * 0.48);
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
  // Desktop: a clicked group replaces the list panel (in map order) until cleared
  // or the filters change. The panel opens if it was folded.
  const selectDesktopGroup = useCallback((ids: string[]) => {
    const order = new Map(latestPoints.current.map((point, index) => [point.id, index]));
    const next = [...new Set(ids)].filter(id => order.has(id)).sort((a, b) => order.get(a)! - order.get(b)!);
    if (!next.length) return;
    setSelectedIds(next); setSelectedId(""); setHighlightedId(null); setCatalogOpen(true);
    listRef.current?.scrollTo({ top: 0 });
  }, []);
  const group = useGroupEvents(isMobile ? null : selectedIds, events);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [group.groupPage]);
  // "Near me": the position stays in this component (never stored or sent). The
  // nearby list reuses the selection list, so it ends like a map group does.
  const [userLocation, setUserLocation] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearby, setNearby] = useState<{ ids: string[]; radiusKm: number; distances: Map<string, string> | null } | null>(null);
  // Notices are translated when shown, so switching the UI language updates them.
  type Notice = { text: (tr: typeof t) => string; alert?: boolean; action?: { label: (tr: typeof t) => string; run: () => void } };
  const [notice, setNotice] = useState<Notice | null>(null);
  const locateRequest = useRef(0);
  const nearbyActive = !!nearby && nearby.ids === selectedIds;
  const partialView = !!(initialRegion || filters.bounds || initialEvent);
  useEffect(() => {
    if (!notice || notice.action) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  function showNearby(position: Position) {
    const here = countryAt(position);
    if (here !== country) {
      setNotice(here
        ? { text: (tr) => tr("현재 위치가 {current} 밖에 있어요. {target} 지도로 이동할까요?", { current: tr(countries[country].name), target: tr(countries[here].name) }), action: { label: (tr) => tr("{country} 지도로 이동", { country: tr(countries[here].name) }), run: () => { handOffPosition(position); setNotice(null); router.push(localizedPath(countries[here].path, locale)); } } }
        : { text: (tr) => tr("현재 위치는 아직 지원하지 않는 지역이에요.") });
      return;
    }
    // A region page, an area search or a shared event link only has part of the
    // country's events: look in the whole country.
    if (partialView) {
      handOffPosition(position);
      startTransition(() => router.push(pathFor("", initialQuery, { ...filters, bounds: "" }), { scroll: false }));
      return;
    }
    setUserLocation(position); setViewportDirty(false);
    setFocus({ latitude: position.latitude, longitude: position.longitude, nonce: Date.now(), zoom: zoomForAccuracy(position.accuracy) });
    const result = nearbyEvents(latestPoints.current, position);
    if (!result.items.length) {
      setNearby(null); setSelectedIds(null);
      setNotice({ text: (tr) => tr("반경 {km}km 안에 행사가 없어요.", { km: result.radiusKm }) });
      return;
    }
    const ids = result.items.map(item => item.id);
    setNearby({ ids, radiusKm: result.radiusKm, distances: position.accuracy > NO_DISTANCE_METERS ? null : new Map(result.items.map(item => [item.id, formatDistance(item.meters)])) });
    setSelectedIds(ids); setSelectedId(""); setHighlightedId(null); setCatalogOpen(true);
    listRef.current?.scrollTo({ top: 0 });
    setNotice(position.accuracy > APPROXIMATE_METERS ? { text: (tr) => tr("대략적인 위치로 이동했어요. 지도를 움직여 원하는 곳을 찾아보세요.") } : null);
  }
  // A late answer must act on the current page, not the one where the button was pressed.
  const showNearbyRef = useRef(showNearby); showNearbyRef.current = showNearby;
  function locate() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator) || !window.isSecureContext) {
      setNotice({ text: (tr) => tr("이 브라우저에서는 위치 기능을 사용할 수 없어요."), alert: true });
      return;
    }
    // A second tap while looking restarts; the older answer is ignored.
    const request = ++locateRequest.current;
    setLocating(true); setNotice(null);
    const done = (found: GeolocationPosition) => {
      if (request !== locateRequest.current) return;
      setLocating(false);
      showNearbyRef.current({ latitude: found.coords.latitude, longitude: found.coords.longitude, accuracy: found.coords.accuracy });
    };
    const fail = (error: GeolocationPositionError) => {
      if (request !== locateRequest.current) return;
      setLocating(false);
      const retry = { label: (tr: typeof t) => tr("다시 시도"), run: () => { setNotice(null); locateRef.current(); } };
      setNotice(error.code === error.PERMISSION_DENIED
        ? { text: (tr) => tr("위치 접근이 거부되었어요. 브라우저 설정에서 위치 권한을 허용해 주세요."), alert: true }
        : error.code === error.TIMEOUT
          ? { text: (tr) => tr("위치를 찾는 데 시간이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요."), alert: true, action: retry }
          : { text: (tr) => tr("현재 위치를 확인할 수 없어요. 기기의 위치 설정과 네트워크를 확인해 주세요."), alert: true, action: retry });
    };
    // Phones try GPS first and fall back to a quicker network fix; desktops go straight to the network fix.
    const network = () => navigator.geolocation.getCurrentPosition(done, fail, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 });
    if (window.matchMedia("(pointer: coarse)").matches) navigator.geolocation.getCurrentPosition(done, (error) => { if (error.code === error.PERMISSION_DENIED) fail(error); else if (request === locateRequest.current) network(); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 });
    else network();
  }
  const locateRef = useRef(locate); locateRef.current = locate;
  // Leaving this view (another country, region, area or event, or unmounting)
  // drops a pending answer and any notice tied to the old view.
  useEffect(() => () => { locateRequest.current++; setLocating(false); setNotice(null); }, [country, initialRegion, filters.bounds, initialEvent?.id]);
  // Arriving with a position in hand: from another country's page or a region page
  // (a new mount), or on this page after an area search was dropped (same mount).
  // Declared after the reset effect so its state wins.
  useEffect(() => {
    if (partialView) return;
    const position = takeHandedOffPosition();
    if (position) showNearby(position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRegion, filters.bounds, initialEvent?.id]);
  const onViewportChange = useCallback((bounds: MapBounds, userChanged: boolean) => {
    setViewportBounds(bounds);
    if (userChanged) setViewportDirty(true);
  }, []);
  // Anything narrowing the list (used to offer a way back from an empty result).
  const filtered = !!(initialRegion || initialQuery || filters.when !== "all" || filters.bounds || filters.category || filters.theme);
  function pathFor(region: string, text: string, nextFilters: DiscoveryFilters, targetPage = 1, nextSort: EventSort = sort) {
    const path = country === "kr" && region && !text.trim() ? `/regions/${encodeURIComponent(region)}` : countries[country].path;
    return localizedPath(path, locale, {
      ...discoveryParams(nextFilters), ...(text.trim() ? { q: text.trim() } : {}),
      ...(region && !path.startsWith("/regions/") ? { region } : {}), ...(targetPage > 1 ? { page: targetPage } : {}),
      ...viewParams(isMobile ? viewRef.current : "map", nextSort),
    });
  }
  function apply(region: string, text: string, nextFilters: DiscoveryFilters) {
    // Applying also settles the search box (a reset clears text that was typed but not submitted).
    setQuery(text);
    setSelectedIds(null); setSelectedId(""); setViewportDirty(false);
    startTransition(() => router.push(pathFor(region, text, nextFilters), { scroll: false }));
  }
  function applySort(next: EventSort) {
    setSelectedIds(null); setSelectedId("");
    startTransition(() => router.push(pathFor(initialRegion, initialQuery, filters, 1, next), { scroll: false }));
  }
  const pageHref = (nextPage: number) => pathFor(initialRegion, initialQuery, filters, nextPage);
  const options = [...regions];
  // The page's one <h1>, the same words as its <title> ("서울특별시의 축제와 행사").
  const regionName = regions.find(item => item.code === initialRegion)?.name;
  const pageHeading = regionName ? t(REGION_PAGE_TITLE, { region: regionName }) : t(COUNTRY_PAGE_TITLES[country]);
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
    <Link prefetch={false} href={pathFor("", initialQuery, { ...filters, bounds: "" })} className={!initialRegion ? "active" : ""} aria-current={!initialRegion ? "page" : undefined}>{t(country === "kr" ? "전국" : "전체")}</Link>
    {options.map(item => <Link key={item.code} prefetch={false} href={pathFor(item.code, initialQuery, { ...filters, bounds: "" })} className={initialRegion === item.code ? "active" : ""} aria-current={initialRegion === item.code ? "page" : undefined}>{item.name}</Link>)}
  </nav>;
  const pages = Math.max(1, Math.ceil(total / 24));

  const sortSelect = <select className="list-view__sort" aria-label={t("정렬")} value={sort} disabled={pending || (!isMobile && !!selectedIds)} onChange={event => applySort(event.target.value as EventSort)}>
    <option value="latest">{t("최신 등록순")}</option><option value="soon">{t("일정 빠른 순")}</option><option value="ending">{t("종료 임박순")}</option>
  </select>;
  const searchAreaButton = viewportDirty && viewportBounds && !(isMobile && (locating || notice)) && <button type="button" className="atlas-search-area" disabled={pending} onClick={() => apply(initialRegion, initialQuery, { ...filters, bounds: viewportBounds.map(n => Number(n.toFixed(5))).join(",") })}>{t("이 지역에서 검색")}</button>;
  const panelLabel = t(catalogOpen ? "목록 접기" : "목록 펼치기");

  // Desktop: a list panel on the left and the map on the right, like a map app.
  // Mobile: full-screen map with the bottom sheet (snapped to the top = list view).
  // Both share one tree shape so the map is not remounted when the viewport
  // check flips to mobile after hydration (the server renders desktop).
  // ?view=list only matters on mobile; on desktop the list is always beside the map.
  return <div ref={root} className={isMobile ? "country-page country-page--atlas is-mobile-atlas has-event-sheet" : `country-page country-page--split${catalogOpen ? "" : " is-panel-closed"}`}>
    {initialEvent && <LinkedEventDialog key={initialEvent.id} event={initialEvent} />}
    {isMobile
      ? <>
        {/* Phones: one floating search bar (back, search, menu) and the category chips over the map — no header band. */}
        <div className="atlas-top" data-view={view}>
          {!initialEvent && <h1 className="visually-hidden">{pageHeading}</h1>}
          {/* The menu is a sibling of the search form: its account dialog has forms of its own. */}
          <div className="atlas-top__bar">
          <form className="atlas-top__search" role="search" onSubmit={event => { event.preventDefault(); (event.currentTarget.querySelector("input") as HTMLInputElement | null)?.blur(); apply(initialRegion, query, filters); }}>
            <Link className="atlas-top__back" href={localizedPath("/", locale)} aria-label={t("지구본으로 돌아가기")} title={t("뒤로가기")}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <input aria-label={t("행사명, 지역, 장소 검색")} placeholder={t("{country} 행사·지역·장소 검색", { country: t(countries[country].name) })} type="search" enterKeyHint="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
            {(query || initialQuery) && <button type="button" className="atlas-top__clear" aria-label={t("검색어 지우기")} onClick={() => { setQuery(""); if (initialQuery) apply(initialRegion, "", filters); }}>×</button>}
          </form>
          <MobileMenu country={country} onCreate={() => createOpener.current?.querySelector("a")?.click()} />
          </div>
          <div className="atlas-top__chips"><CategoryChips value={filters.category} disabled={pending} onChange={category => apply(initialRegion, initialQuery, { ...filters, category, tag: "" })} /></div>
        </div>
        {/* The one "post an event" dialog on phones: opened from the menu or by ?create=1. */}
        <span ref={createOpener}><EventCreateButton openFromQuery className="atlas-create-opener" /></span>
      </>
      : <section id="atlas-catalog" className="split-panel" aria-label={t("행사 목록")} hidden={!catalogOpen}>
        <div className="split-panel__top">
          {!initialEvent && <h1 className="visually-hidden">{pageHeading}</h1>}
          <MinimalMasthead back actions={<CountrySwitch country={country} heading="p" />} />
          {searchForm}
          <CategoryChips value={filters.category} disabled={pending} onChange={category => apply(initialRegion, initialQuery, { ...filters, category, tag: "" })} />
          <TagChips tags={tagChips} value={filters.tag} disabled={pending} onChange={tag => apply(initialRegion, initialQuery, { ...filters, tag })} />
          <QuickChips filters={filters} disabled={pending} onChange={next => { if (next.when !== "custom") setCustomDates(false); apply(initialRegion, initialQuery, next); }} />
          <div className="split-panel__filters">{dateFilter}{sortSelect}</div>
        </div>
        <div className={`split-panel__summary${selectedIds ? " is-selection" : ""}`}>
          {selectedIds ? <>
            <span><strong>{nearbyActive ? t("내 주변 행사") : t("선택한 위치의 행사")}</strong>{nearbyActive && <> · {t("반경 {km}km", { km: nearby!.radiusKm })}</>} · {t("총 {count}개", { count: selectedIds.length })}</span>
            <button type="button" className="list-view__chip" onClick={() => { setSelectedIds(null); setSelectedId(""); listRef.current?.scrollTo({ top: 0 }); listRef.current?.focus({ preventScroll: true }); }}>{t("전체 목록")}</button>
          </> : <span>{t("총 {count}개", { count: total })}</span>}
          {filters.bounds && <button type="button" className="list-view__chip" onClick={() => apply(initialRegion, initialQuery, { ...filters, bounds: "" })}>{t("현재 지도 영역")} <span aria-hidden="true">×</span><span className="visually-hidden">{t("영역 해제")}</span></button>}
        </div>
        <div ref={listRef} className="split-panel__list" aria-busy={pending || group.loading} tabIndex={-1}>
          {selectedIds ? <>
            {group.loading ? <p className="split-panel__notice" role="status">{t("불러오는 중…")}</p>
              : group.error ? <div className="split-panel__notice" role="alert"><p>{t("행사를 불러오지 못했어요.")}</p><button type="button" className="button button-secondary" onClick={group.retry}>{t("다시 시도")}</button></div>
              : !group.groupEvents.length ? <p className="split-panel__notice">{t("아직 발견하지 못했어요.")}</p>
              : <div className="split-panel__rows">{group.groupEvents.map(event => <EventListItem key={event.id} event={event} selected={selectedId === event.id} highlighted={highlightedId === event.id} onHover={handleCardHighlight} onShowOnMap={showOnMap} distance={nearbyActive ? nearby!.distances?.get(event.id) : undefined} />)}</div>}
            {selectedIds.length > 24 && <nav className="pagination" aria-label={t("행사 목록 페이지")}>
              {group.groupPage > 0 && <button type="button" className="button button-secondary" onClick={() => { group.setGroupPage(value => value - 1); listRef.current?.focus({ preventScroll: true }); }}>{t("← 이전")}</button>}
              <span className="list-view__page">{t("{current} / {total} 페이지", { current: group.groupPage + 1, total: Math.ceil(selectedIds.length / 24) })}</span>
              {(group.groupPage + 1) * 24 < selectedIds.length && <button type="button" className="button button-secondary" onClick={() => { group.setGroupPage(value => value + 1); listRef.current?.focus({ preventScroll: true }); }}>{t("다음 →")}</button>}
            </nav>}
          </> : <>
          {events.length
            ? <div className="split-panel__rows">{events.map(event => <EventListItem key={event.id} event={event} selected={selectedId === event.id} highlighted={highlightedId === event.id} onHover={handleCardHighlight} onShowOnMap={showOnMap} />)}</div>
            : <div className="empty-state"><span aria-hidden="true">✳</span><h2>{t("아직 발견하지 못했어요.")}</h2>
              {filtered && <Link className="button button-secondary empty-state__reset" href={pathFor("", "", emptyDiscoveryFilters)} onClick={() => setQuery("")}>{t("검색·필터 지우기")}</Link>}</div>}
          {(page > 1 || page * 24 < total) && <nav className="pagination" aria-label={t("행사 목록 페이지")}>
            {page > 1 && <Link className="button button-secondary" href={pageHref(page - 1)}>{t("← 이전")}</Link>}
            <span className="list-view__page">{t("{current} / {total} 페이지", { current: page, total: pages })}</span>
            {page * 24 < total && <Link className="button button-secondary" href={pageHref(page + 1)}>{t("다음 →")}</Link>}
          </nav>}
          </>}
          <SourceNotice country={country} />
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
            onSelectEvents={isMobile ? selectMapEvents : undefined} onSelectGroup={isMobile ? undefined : selectDesktopGroup} selectedEventId={selectedId} onViewportChange={onViewportChange} focusTarget={focus}
            onEventHighlight={isMobile ? undefined : handleMapHighlight} highlightedId={isMobile ? undefined : highlightedId}
            onLocate={locate} locating={locating} userLocation={userLocation} />
          {searchAreaButton}
          {locating && <p className="map-notice" role="status">{t("내 위치 찾는 중…")}</p>}
          {!locating && notice && <div className={`map-notice${notice.alert ? " is-alert" : ""}`} role={notice.alert ? "alert" : "status"}>
            <p>{notice.text(t)}</p>
            {notice.action && <button type="button" onClick={notice.action.run}>{notice.action.label(t)}</button>}
            <button type="button" className="map-notice__close" aria-label={t("닫기")} onClick={() => setNotice(null)}>×</button>
          </div>}
          {total > mapPoints.length && <p className="map-help">{t("지도에는 최대 5,000개의 행사만 표시돼요.")}</p>}
        </aside>
      </div>
    </div>
    {isMobile ? <>
      <MobileEventSheet country={country} events={events} total={total} page={page} regions={options} region={initialRegion} query={initialQuery} filters={filters} pending={pending} tagChips={tagChips} featured={featured}
        selectedIds={selectedIds} selectedId={selectedId} onSelect={setSelectedId}
        selectionLabel={nearbyActive ? t("내 주변 {km}km", { km: nearby!.radiusKm }) : undefined}
        distanceOf={nearbyActive && nearby!.distances ? (id) => nearby!.distances!.get(id) : undefined} onSelectionClear={() => { setSelectedIds(null); setSelectedId(""); }}
        onApply={apply} pageHref={pageHref} onHeight={onHeight}
        view={view} onViewChange={changeView} sort={sort} onSort={applySort} onShowOnMap={showOnMap} />
    </> : <SiteTools atlas />}
  </div>;
}
