"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, type SheetRef } from "react-modal-sheet";
import { useMotionValueEvent, useReducedMotion } from "motion/react";
import Link from "next/link";
import { todayInCountry, type FestivalEvent } from "@/lib/events";
import type { CountryCode } from "@/lib/countries";
import { validDate, type DateChoice, type DiscoveryFilters, type EventSort, type ExplorerView } from "@/lib/discovery-filters";
import { useTranslations } from "./language-provider";
import { SiteTools } from "./site-tools";
import { EventListItem } from "./event-list-item";
import { TrafficCounter } from "./traffic-counter";
import { SourceNotice } from "./source-notice";
import { CategoryChips } from "./category-chips";
import { TagChips } from "./tag-chips";
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
};
function TrackHeight({ onHeight }: { onHeight: Props["onHeight"] }) {
  const { yInverted } = Sheet.useContext();
  useMotionValueEvent(yInverted, "change", onHeight);
  useEffect(() => { onHeight(yInverted.get()); }, [onHeight, yInverted]);
  return null;
}

export function MobileEventSheet(props: Props) {
  const { country, events, total, page, regions, region, query, filters, pending, tagChips, selectedIds, selectedId, onSelect, onApply, onSelectionClear, pageHref, onHeight, view, onViewChange, sort, onSort, onShowOnMap, selectionLabel, distanceOf } = props;
  const { t } = useTranslations();
  const reduced = useReducedMotion();
  const sheet = useRef<SheetRef>(null);
  const container = useRef<HTMLDivElement>(null);
  const trackHeight = useCallback((height: number) => {
    onHeight(height);
    container.current?.style.setProperty("--sheet-body-opacity", height > peekRef.current + 10 ? "1" : "0");
  }, [onHeight]);
  const scroll = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // Snap 3 (full height) is the list view; lower snaps show the map.
  const [snap, setSnap] = useState(view === "list" ? 3 : 1);
  // The lowest snap shows the fixed header; a tag chip row makes it taller.
  const peek = tagChips.length ? 180 : 144;
  const peekRef = useRef(peek); peekRef.current = peek;
  // Re-snap only when the row appears or disappears (the first render has no snap points yet).
  const shownPeek = useRef(peek);
  useEffect(() => { if (shownPeek.current === peek) return; shownPeek.current = peek; if (snapRef.current === 1) sheet.current?.snapTo(1); }, [peek]);
  const snapRef = useRef(snap); snapRef.current = snap;
  const [showFilters, setShowFilters] = useState(false);
  const filtersOpen = useRef(false); filtersOpen.current = showFilters;
  const [text, setText] = useState(query);
  const [custom, setCustom] = useState(filters.when === "custom");
  const [from, setFrom] = useState(filters.from || todayInCountry(country));
  const [to, setTo] = useState(filters.to || todayInCountry(country));
  const [formError, setFormError] = useState("");
  const [groupPage, setGroupPage] = useState(0);
  const [groupEvents, setGroupEvents] = useState<FestivalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => { setText(query); setCustom(filters.when === "custom"); setFrom(filters.from || todayInCountry(country)); setTo(filters.to || todayInCountry(country)); }, [query, filters.when, filters.from, filters.to, country]);
  useEffect(() => {
    setGroupPage(0); setShowFilters(false); scroll.current?.scrollTo({ top: 0 });
    if (selectedIds) sheet.current?.snapTo(2);
  }, [selectedIds]);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [page, groupPage, events]);
  useEffect(() => {
    if (view === "list" && snapRef.current !== 3) { setShowFilters(false); sheet.current?.snapTo(3); }
    if (view === "map" && snapRef.current === 3) sheet.current?.snapTo(1);
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
  const levels = ["", t("지도 중심"), t("지도와 목록"), t("목록 중심")];
  const activeCount = Number(!!region) + Number(filters.when !== "all") + Number(!!query) + Number(!!filters.bounds);
  function openFilters() { filtersOpen.current = !showFilters; setShowFilters(value => !value); sheet.current?.snapTo(3); }
  function applyDate(value: DateChoice) {
    setCustom(value === "custom"); setFormError("");
    if (value === "custom") { filtersOpen.current = true; setShowFilters(true); sheet.current?.snapTo(3); return; }
    onApply(region, query, { ...filters, when: value, from: "", to: "" });
  }
  return <>
    <Sheet ref={sheet} isOpen onClose={() => sheet.current?.snapTo(1)} detent="full"
      snapPoints={[0, peek, 0.5, 1]} initialSnap={view === "list" ? 3 : 1} onSnap={index => {
        const next = Math.max(1, index); setSnap(next);
        // Opening the filter panel expands the sheet but is not a switch to the list view.
        if (next !== 3 || !filtersOpen.current) onViewChange(next === 3 ? "list" : "map");
      }} disableDismiss disableScrollLocking
      prefersReducedMotion={!!reduced} tweenConfig={{ ease: "easeOut", duration: 0.26 }}
      onDragStart={() => { dragging.current = true; }} onDragEnd={() => { setTimeout(() => { dragging.current = false; }, 0); }}
      style={{ zIndex: 5, top: "calc(65px + max(12px, env(safe-area-inset-top)))" }}>
      <TrackHeight onHeight={trackHeight} />
      <Sheet.Container ref={container} className="event-sheet" role="region" aria-label={t("행사 목록")} data-snap={snap}
        onKeyDown={event => {
          if (event.key === "Escape" && !(event.target as Element).closest("dialog")) {
            event.preventDefault(); setShowFilters(false); sheet.current?.snapTo(1);
          }
        }}>
        <Sheet.Header className="event-sheet__handle">
          <button type="button" className="event-sheet__handle-button" aria-label={t("목록 높이 조절")} title={t("목록 높이 조절")}
            aria-expanded={snap > 1} aria-controls="event-sheet-body"
            onClick={() => { if (!dragging.current) sheet.current?.snapTo(snap === 3 ? 1 : snap + 1); }}
            onKeyDown={event => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault(); sheet.current?.snapTo(Math.min(3, Math.max(1, snap + (event.key === "ArrowUp" ? 1 : -1))));
              }
            }}><span aria-hidden="true" /><span className="visually-hidden">{levels[snap]}</span></button>
        </Sheet.Header>
        <div className="event-sheet__fixed">
          <div className="event-sheet__heading"><strong>{selectedIds ? selectionLabel || t("선택한 위치의 행사") : t("행사 목록")}</strong>
            <span>{t("총 {count}개", { count: selectedIds ? selectedIds.length : total })}</span>
          </div>
          <div className="event-sheet__filters">
            <select aria-label={t("정렬")} value={sort} disabled={pending || !!selectedIds} onChange={event => onSort(event.target.value as EventSort)}>
              <option value="latest">{t("최신 등록순")}</option><option value="soon">{t("일정 빠른 순")}</option><option value="ending">{t("종료 임박순")}</option>
            </select>
            <select aria-label={t("기간 필터")} value={custom ? "custom" : filters.when} disabled={pending} onChange={event => applyDate(event.target.value as DateChoice)}>
              <option value="all">{t("기간 전체")}</option><option value="today">{t("오늘")}</option><option value="weekend">{t("이번 주말")}</option><option value="month">{t("이번 달")}</option><option value="custom">{t("기간 선택")}</option>
            </select>
            <select aria-label={t("지역 필터")} value={region} disabled={pending} onChange={event => onApply(event.target.value, query, { ...filters, bounds: "" })}>
              <option value="">{t(country === "kr" ? "전국" : "전체")}</option>{regions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
            <button type="button" className={showFilters || activeCount ? "is-active" : ""} aria-label={t("검색 및 지도 설정")} aria-expanded={showFilters} onClick={openFilters}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 17h16" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="7" r="2.5" fill="white" stroke="currentColor" strokeWidth="1.5"/><circle cx="15" cy="17" r="2.5" fill="white" stroke="currentColor" strokeWidth="1.5"/></svg>
              {!!activeCount && <small>{activeCount}</small>}
            </button>
          </div>
          <CategoryChips value={filters.category} disabled={pending} onChange={category => onApply(region, query, { ...filters, category, tag: "" })} />
          <TagChips tags={tagChips} value={filters.tag} disabled={pending} onChange={tag => onApply(region, query, { ...filters, tag })} />
        </div>
        <Sheet.Content id="event-sheet-body" disableDrag disableScroll={snap === 1} inert={snap === 1} style={{ opacity: "var(--sheet-body-opacity, 0)" }} scrollRef={scroll} scrollClassName="event-sheet__scroll" scrollStyle={{ padding: "0 16px", paddingBottom: "calc(max(24px, env(safe-area-inset-bottom), var(--keyboard-inset-height, 0px)) + 64px)" }} aria-busy={pending || loading}>
          {showFilters ? <div className="event-sheet__settings">
            <form onSubmit={event => {
              event.preventDefault();
              if (custom && (!validDate(from) || !validDate(to) || from > to)) { setFormError(t("시작일과 종료일을 확인해주세요.")); return; }
              setFormError(""); setShowFilters(false);
              onApply(region, text, { ...filters, when: custom ? "custom" : filters.when, from: custom ? from : "", to: custom ? to : "" });
            }}>
              <label>{t("검색")}<input type="search" placeholder={t("행사, 지역, 장소 검색")} value={text} maxLength={100} onChange={event => setText(event.target.value)} /></label>
              {custom && <div className="event-sheet__dates"><label>{t("시작일")}<input type="date" value={from} onChange={event => setFrom(event.target.value)} required /></label><label>{t("종료일")}<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} required /></label></div>}
              {formError && <p role="alert">{formError}</p>}
              <div className="event-sheet__apply"><button type="button" onClick={() => { setShowFilters(false); setText(""); setCustom(false); onApply("", "", { when: "all", from: "", to: "", bounds: "", category: filters.category, tag: filters.tag }); }}>{t("초기화")}</button><button type="submit" disabled={pending}>{t("적용")}</button></div>
            </form>
            <SiteTools /><TrafficCounter inline />
          </div> : <>
            {selectedIds && <div className="event-sheet__selection"><span>{selectionLabel || t("지도에서 선택한 위치")}</span><button type="button" onClick={onSelectionClear}>{t("전체 목록")}</button></div>}
            {filters.bounds && !selectedIds && <div className="event-sheet__selection"><span>{t("현재 지도 영역")}</span><button type="button" onClick={() => onApply(region, query, { ...filters, bounds: "" })}>{t("영역 해제")}</button></div>}
            {loading ? <p className="event-sheet__notice" role="status">{t("불러오는 중…")}</p> : error ? <div className="event-sheet__notice" role="alert"><p>{t("행사를 불러오지 못했어요.")}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{t("다시 시도")}</button></div> : items.length ? <div className="event-sheet__list">
              {items.map(event => <EventListItem key={event.id} event={event} selected={event.id === selectedId} onOpen={() => onSelect(event.id)} onShowOnMap={onShowOnMap} distance={distanceOf?.(event.id)} />)}
            </div> : <div className="event-sheet__empty"><span aria-hidden="true">✳</span><p>{t("아직 발견하지 못했어요.")}</p></div>}
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
          </>}
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  </>;
}
