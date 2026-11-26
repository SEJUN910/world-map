"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, type SheetRef } from "react-modal-sheet";
import { useMotionValueEvent, useReducedMotion } from "motion/react";
import Link from "next/link";
import { todayInCountry, type FestivalEvent } from "@/lib/events";
import type { CountryCode } from "@/lib/countries";
import { validDate, type DateChoice, type DiscoveryFilters, type EventSort, type ExplorerView } from "@/lib/discovery-filters";
import { useTranslations } from "./language-provider";
import { EventListItem } from "./event-list-item";
import { TrafficCounter } from "./traffic-counter";
import { SourceNotice } from "./source-notice";
import { TagChips } from "./tag-chips";
import { QuickChips } from "./quick-chips";
import { SelectChip } from "./select-chip";
import { FeaturedStrip } from "./featured-strip";
import type { EventTag } from "@/lib/event-tags";

type Props = {
  country: CountryCode; events: FestivalEvent[]; total: number; page: number;
  regions: { code: string; name: string }[]; region: string; query: string; filters: DiscoveryFilters; pending: boolean; tagChips: EventTag[];
  selectedIds: string[] | null; selectedId: string;
  onSelectionClear: () => void; onSelect: (id: string) => void;
  onApply: (region: string, query: string, filters: DiscoveryFilters) => void;
  pageHref: (page: number) => string;
  onHeight: (height: number) => void;
  view: ExplorerView; onViewChange: (view: ExplorerView) => void;
  sort: EventSort; onSort: (sort: EventSort) => void;
  onShowOnMap: (event: FestivalEvent) => void;
  // "Near me": heading for the selection and the distance of each row.
  selectionLabel?: string; distanceOf?: (id: string) => string | undefined;
  // This weekend's picks, shown as a strip above the full list when nothing is filtered.
  featured?: FestivalEvent[];
};
function TrackHeight({ onHeight }: { onHeight: Props["onHeight"] }) {
  const { yInverted } = Sheet.useContext();
  useMotionValueEvent(yInverted, "change", onHeight);
  useEffect(() => { onHeight(yInverted.get()); }, [onHeight, yInverted]);
  return null;
}

// Sheet snaps: 1 handle + heading (map as large as possible), 2 heading + first
// event (default), 3 half, 4 full height = list view (?view=list).
const SNAP_MIN = 84, SNAP_PREVIEW = 188, LIST = 4;

export function MobileEventSheet(props: Props) {
  const { country, events, total, page, regions, region, query, filters, pending, tagChips, selectedIds, selectedId, onSelect, onApply, onSelectionClear, pageHref, onHeight, view, onViewChange, sort, onSort, onShowOnMap, selectionLabel, distanceOf, featured = [] } = props;
  const { t } = useTranslations();
  const reduced = useReducedMotion();
  const sheet = useRef<SheetRef>(null);
  const container = useRef<HTMLDivElement>(null);
  const trackHeight = useCallback((height: number) => {
    onHeight(height);
    // The scrolling body (filters, list) fades in above the preview height.
    container.current?.style.setProperty("--sheet-body-opacity", height > SNAP_PREVIEW + 10 ? "1" : "0");
  }, [onHeight]);
  const scroll = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [snap, setSnap] = useState(view === "list" ? LIST : 2);
  const snapRef = useRef(snap); snapRef.current = snap;
  // True only while the two date fields are open; an applied range shows in the chip instead.
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(filters.from || todayInCountry(country));
  const [to, setTo] = useState(filters.to || todayInCountry(country));
  const [formError, setFormError] = useState("");
  const [groupPage, setGroupPage] = useState(0);
  const [groupEvents, setGroupEvents] = useState<FestivalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => { setCustom(false); setFormError(""); setFrom(filters.from || todayInCountry(country)); setTo(filters.to || todayInCountry(country)); }, [filters.when, filters.from, filters.to, country]);
  useEffect(() => {
    setGroupPage(0); scroll.current?.scrollTo({ top: 0 });
    // A map selection or "near me" opens the sheet halfway, unless the list is already open.
    if (selectedIds && snapRef.current < 3) sheet.current?.snapTo(3);
  }, [selectedIds]);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [page, groupPage, events]);
  useEffect(() => {
    if (view === "list" && snapRef.current !== LIST) sheet.current?.snapTo(LIST);
    if (view === "map" && snapRef.current === LIST) sheet.current?.snapTo(2);
  }, [view]);
  useEffect(() => {
    if (!selectedIds) { setGroupEvents([]); setLoading(false); setError(false); return; }
    const controller = new AbortController();
    const ids = selectedIds.slice(groupPage * 24, (groupPage + 1) * 24);
    const known = new Map(events.map(event => [event.id, event]));
    const missing = ids.filter(id => !known.has(id));
    if (!missing.length) {
      setGroupEvents(ids.map(id => known.get(id)!)); setLoading(false); setError(false);
      return;
    }
    setLoading(true); setError(false); setGroupEvents([]);
    fetch(`/api/map-posters?ids=${missing.join(",")}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<FestivalEvent[]>; })
      .then(data => {
        if (controller.signal.aborted) return;
        const byId = new Map([...known, ...data.map(event => [event.id, event] as const)]);
        setGroupEvents(ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []));
      }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedIds, groupPage, retry, events]);

  const items = selectedIds ? groupEvents : events;
  const levels = ["", t("지도 중심"), t("지도 중심"), t("지도와 목록"), t("목록 중심")];
  // Search, region, date or map area narrow the list; the reset chip clears those (category and tag have their own chips).
  const narrowed = !!(region || query || filters.when !== "all" || filters.bounds || filters.theme);
  // Shown next to the count so a lowered sheet still says the list is filtered (the category has its own chips on top).
  const filterCount = [region, query, filters.when !== "all", filters.bounds, filters.theme, filters.tag].filter(Boolean).length;
  // What the date chip says: the choice, or the applied range ("11.20–11.30").
  const short = (date: string) => date.slice(5).replace("-", ".");
  const dateLabel = custom ? t("기간 선택")
    : filters.when === "custom" ? `${short(filters.from)}–${short(filters.to)}`
    : t(({ all: "기간", today: "오늘", weekend: "이번 주말", month: "이번 달", custom: "기간 선택" } as const)[filters.when]);
  // Close the date fields and drop unapplied edits.
  function closeDates() { setCustom(false); setFormError(""); setFrom(filters.from || todayInCountry(country)); setTo(filters.to || todayInCountry(country)); }
  function applyDate(value: DateChoice) {
    // "applied" is the current range itself (listed so "기간 선택" can be picked again to change it).
    if ((value as string) === "applied") { closeDates(); return; }
    setCustom(value === "custom"); setFormError("");
    if (value !== "custom") onApply(region, query, { ...filters, when: value, from: "", to: "" });
  }
  return <>
    <Sheet ref={sheet} isOpen onClose={() => sheet.current?.snapTo(1)} detent="full"
      snapPoints={[0, SNAP_MIN, SNAP_PREVIEW, 0.5, 1]} initialSnap={view === "list" ? LIST : 2} onSnap={index => {
        const next = Math.max(1, index); setSnap(next);
        onViewChange(next === LIST ? "list" : "map");
      }} disableDismiss disableScrollLocking
      prefersReducedMotion={!!reduced} tweenConfig={{ ease: "easeOut", duration: 0.26 }}
      onDragStart={() => { dragging.current = true; }} onDragEnd={() => { setTimeout(() => { dragging.current = false; }, 0); }}
      style={{ zIndex: 5, top: "var(--atlas-mobile-header-height, 112px)" }}>
      <TrackHeight onHeight={trackHeight} />
      <Sheet.Container ref={container} className="event-sheet" role="region" aria-label={t("행사 목록")} data-snap={snap}
        onKeyDown={event => {
          if (event.key === "Escape" && !(event.target as Element).closest("dialog")) {
            event.preventDefault(); if (snapRef.current > 2) sheet.current?.snapTo(2);
          }
        }}>
        <Sheet.Header className="event-sheet__handle">
          <button type="button" className="event-sheet__handle-button" aria-label={t("목록 높이 조절")} title={t("목록 높이 조절")}
            aria-expanded={snap > 2} aria-controls="event-sheet-body"
            onClick={() => { if (!dragging.current) sheet.current?.snapTo(snap === LIST ? 2 : snap + 1); }}
            onKeyDown={event => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault(); sheet.current?.snapTo(Math.min(LIST, Math.max(1, snap + (event.key === "ArrowUp" ? 1 : -1))));
              }
            }}><span aria-hidden="true" /><span className="visually-hidden">{levels[snap]}</span></button>
        </Sheet.Header>
        <div className="event-sheet__fixed">
          <div className="event-sheet__heading"><strong>{selectedIds ? selectionLabel || t("선택한 위치") : t("행사 목록")}</strong>
            <span>{t("총 {count}개", { count: selectedIds ? selectedIds.length : total })}{!selectedIds && filterCount > 0 && <em className="event-sheet__filtered"> · {t("필터 {count}", { count: filterCount })}</em>}</span>
            {/* Leaving a map selection or "near me": one chip here instead of a row of its own. */}
            {selectedIds && <button type="button" className="event-sheet__clear" onClick={onSelectionClear} aria-label={t("전체 목록")}><span aria-hidden="true">×</span> {t("전체")}</button>}
            {/* Map ⇄ list lives here, not floating over the map or the rows. */}
            <button type="button" className="atlas-view-switch" onClick={() => onViewChange(view === "list" ? "map" : "list")}>
              {view === "list"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
              <span>{t(view === "list" ? "지도보기" : "목록보기")}</span>
            </button>
          </div>
          {snap === 2 && <div className="event-sheet__preview">
            {loading ? <p className="event-sheet__notice" role="status">{t("불러오는 중…")}</p>
              : error ? <div className="event-sheet__notice" role="alert"><p>{t("행사를 불러오지 못했어요.")}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{t("다시 시도")}</button></div>
              : items[0] ? <EventListItem event={items[0]} selected={items[0].id === selectedId} onOpen={() => onSelect(items[0].id)} onShowOnMap={onShowOnMap} distance={distanceOf?.(items[0].id)} />
              : <p className="event-sheet__notice">{t("아직 발견하지 못했어요.")}</p>}
          </div>}
        </div>
        <Sheet.Content id="event-sheet-body" disableDrag disableScroll={snap <= 2} inert={snap <= 2} style={{ opacity: "var(--sheet-body-opacity, 0)" }} scrollRef={scroll} scrollClassName="event-sheet__scroll" scrollStyle={{ padding: "0 16px", paddingBottom: "calc(max(24px, env(safe-area-inset-bottom), var(--keyboard-inset-height, 0px)) + 24px)" }} aria-busy={pending || loading}>
          {/* Two rows by role: what to sort and narrow by (select chips), then one-tap picks. */}
          <div className="event-sheet__controls">
            <div className="event-sheet__filters">
              <SelectChip display={t(sort === "soon" ? "일정 빠른 순" : sort === "ending" ? "종료 임박순" : "최신순")} active={sort !== "latest"}
                aria-label={t("정렬")} value={sort} disabled={pending || !!selectedIds} onChange={event => onSort(event.target.value as EventSort)}>
                <option value="latest">{t("최신 등록순")}</option><option value="soon">{t("일정 빠른 순")}</option><option value="ending">{t("종료 임박순")}</option>
              </SelectChip>
              <SelectChip display={dateLabel} active={custom || filters.when !== "all"}
                aria-label={t("기간 필터")} value={custom ? "custom" : filters.when === "custom" ? "applied" : filters.when} disabled={pending} onChange={event => applyDate(event.target.value as DateChoice)}>
                {filters.when === "custom" && <option value="applied">{`${short(filters.from)}–${short(filters.to)}`}</option>}<option value="all">{t("기간 전체")}</option><option value="today">{t("오늘")}</option><option value="weekend">{t("이번 주말")}</option><option value="month">{t("이번 달")}</option><option value="custom">{t("기간 선택")}</option>
              </SelectChip>
              <SelectChip display={regions.find(item => item.code === region)?.name || t(country === "kr" ? "전국" : "전체")} active={!!region}
                aria-label={t("지역 필터")} value={region} disabled={pending} onChange={event => onApply(event.target.value, query, { ...filters, bounds: "" })}>
                <option value="">{t(country === "kr" ? "전국" : "전체")}</option>{regions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
              </SelectChip>
              {filters.bounds && <button type="button" className="event-sheet__chip" onClick={() => onApply(region, query, { ...filters, bounds: "" })}>{t("현재 지도 영역")} <span aria-hidden="true">×</span><span className="visually-hidden">{t("영역 해제")}</span></button>}
              {narrowed && <button type="button" className="event-sheet__chip" disabled={pending} onClick={() => { setCustom(false); onApply("", "", { when: "all", from: "", to: "", bounds: "", category: filters.category, tag: filters.tag, theme: "" }); }}>↺ {t("초기화")}</button>}
            </div>
            {/* Picking "기간 선택" opens the two dates right here (there is no separate settings screen). */}
            {custom && <form className="event-sheet__dates" onSubmit={event => {
              event.preventDefault();
              if (!validDate(from) || !validDate(to) || from > to) { setFormError(t("시작일과 종료일을 확인해주세요.")); return; }
              setFormError("");
              setCustom(false);
              onApply(region, query, { ...filters, when: "custom", from, to });
            }}>
              <label>{t("시작일")}<input type="date" value={from} onChange={event => setFrom(event.target.value)} required /></label>
              <label>{t("종료일")}<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} required /></label>
              <div className="event-sheet__apply"><button type="button" onClick={closeDates}>{t("취소")}</button><button type="submit" disabled={pending}>{t("적용")}</button></div>
              {formError && <p role="alert">{formError}</p>}
            </form>}
            <QuickChips filters={filters} disabled={pending} onChange={next => { if (next.when !== "custom") setCustom(false); onApply(region, query, next); }} />
            <TagChips tags={tagChips} value={filters.tag} disabled={pending} onChange={tag => onApply(region, query, { ...filters, tag })} />
          </div>
          {snap === LIST && !selectedIds && !narrowed && !filters.category && page === 1 && <FeaturedStrip events={featured} onShowOnMap={onShowOnMap} />}
          {loading ? <p className="event-sheet__notice" role="status">{t("불러오는 중…")}</p> : error ? <div className="event-sheet__notice" role="alert"><p>{t("행사를 불러오지 못했어요.")}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{t("다시 시도")}</button></div> : items.length ? <div className="event-sheet__list">
            {items.map(event => <EventListItem key={event.id} event={event} selected={event.id === selectedId} onOpen={() => onSelect(event.id)} onShowOnMap={onShowOnMap} distance={distanceOf?.(event.id)} />)}
          </div> : <div className="event-sheet__empty"><span aria-hidden="true">✳</span><p>{t("아직 발견하지 못했어요.")}</p>
            {(narrowed || filters.category) && <button type="button" className="button button-secondary" onClick={() => onApply("", "", { when: "all", from: "", to: "", bounds: "", category: "", tag: "", theme: "" })}>{t("검색·필터 지우기")}</button>}</div>}
          {!loading && !error && <nav className="event-sheet__pages" aria-label={t("행사 목록 페이지")}>
            {selectedIds ? <>
              {groupPage > 0 && <button type="button" onClick={() => setGroupPage(value => value - 1)}>{t("← 이전")}</button>}
              {(groupPage + 1) * 24 < selectedIds.length && <button type="button" onClick={() => setGroupPage(value => value + 1)}>{t("다음 →")}</button>}
            </> : <>
              {page > 1 && <Link prefetch={false} href={pageHref(page - 1)}>{t("← 이전")}</Link>}
              {page * 24 < total && <Link prefetch={false} href={pageHref(page + 1)}>{t("다음 →")}</Link>}
            </>}
          </nav>}
          <SourceNotice country={country} />
          <TrafficCounter inline />
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  </>;
}
