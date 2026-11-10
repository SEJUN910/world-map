"use client";
import { useTranslations } from "@/components/language-provider";
import { localizedPath } from "@/lib/seo";
import { countries, type CountryCode } from "@/lib/countries";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FestivalEvent } from "@/lib/events";
import { EventCard } from "./event-card";
import { EventMap, type EventMapPoint } from "./event-map";
import { MinimalMasthead } from "./minimal-masthead";
import { LinkedEventDialog } from "./event-poster-dialog";
import { TrafficCounter } from "./traffic-counter";
import { SiteTools } from "./site-tools";
import { MobileAtlasControls, useMobileAtlas } from "./mobile-atlas-controls";
export function Explorer({
  country = "kr",
  events,
  mapPoints,
  total,
  regions,
  initialRegion = "",
  initialQuery = "",
  page = 1,
  initialEvent = null,
}: {
  country?: CountryCode;
  events: FestivalEvent[];
  mapPoints: EventMapPoint[];
  total: number;
  regions: { code: string; name: string }[];
  initialRegion?: string;
  initialQuery?: string;
  page?: number;
  initialEvent?: FestivalEvent | null;
}) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const isMobile = useMobileAtlas();
  const [catalogChoice, setCatalogChoice] = useState<boolean | null>(null);
  const catalogOpen = catalogChoice ?? !isMobile;
  function toggleCatalog() { setCatalogChoice(!catalogOpen); setPanel(null); }
  const [panel, setPanel] = useState<"search" | "tools" | null>(null);
  const searchOpener = useRef<HTMLButtonElement>(null);
  const toolsOpener = useRef<HTMLButtonElement>(null);
  const regionStrip = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isMobile) return;
    const strip = regionStrip.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    const box = active.getBoundingClientRect();
    strip.scrollLeft += box.left - strip.getBoundingClientRect().left - (strip.clientWidth - box.width) / 2;
  }, [isMobile, initialRegion, country]);
  useEffect(() => { if (!isMobile) setPanel(null); }, [isMobile]);
  const [pending, startTransition] = useTransition();
  const CountryHeading = initialEvent ? "p" : "h1";
  function href(region: string, targetPage = 1) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (region) params.set("region", region);
    if (targetPage > 1) params.set("page", String(targetPage));
    const path = country === "kr" && region && !query.trim() ? `/regions/${encodeURIComponent(region)}` : countries[country].path;
    if (path.startsWith("/regions/")) params.delete("region");
    return localizedPath(`${path}${params.size ? `?${params}` : ""}`, locale);
  }
  function choose(region: string) {
    startTransition(() => router.push(href(region), { scroll: false }));
  }
  const options = [...regions];
  for (const event of events)
    if (event.region.trim() && !options.some((item) => item.code === event.regionCode))
      options.push({ code: event.regionCode, name: event.region });
  const controls = <>
    <SiteTools atlas catalogOpen={catalogOpen} onToggleCatalog={toggleCatalog} />
        <form
          className="search-field country-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPanel(null);
            choose(initialRegion);
          }}
        >
          <input
            aria-label={t("행사명, 지역, 장소 검색")}
            placeholder={t("행사, 지역, 장소 검색")}
            type="search"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className="country-search-submit" disabled={pending} aria-label={t("검색")} title={t("검색")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </form>

  </>;
  return (
    <div className={`country-page country-page--atlas${isMobile ? " is-mobile-atlas" : ""}${catalogOpen ? "" : " is-catalog-hidden"}`}>
      <MinimalMasthead back actions={<div className="atlas-mobile-actions">
        <button ref={searchOpener} type="button" aria-label={t("검색")} aria-haspopup="dialog" aria-expanded={panel === "search"} aria-controls="atlas-mobile-controls" onClick={() => setPanel("search")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button ref={toolsOpener} type="button" aria-label={t("지도 설정")} aria-haspopup="dialog" aria-expanded={panel === "tools"} aria-controls="atlas-mobile-controls" onClick={() => setPanel("tools")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 17h16" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="7" r="2.5" fill="white" stroke="currentColor" strokeWidth="1.5"/><circle cx="15" cy="17" r="2.5" fill="white" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>} />
      <button className="atlas-mobile-catalog-toggle" type="button" aria-controls="atlas-catalog" aria-expanded={catalogOpen} onClick={toggleCatalog}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="m8 14 3-3 5 6M8 7h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {t(catalogOpen ? "포스터 접기" : "포스터 보기")}
      </button>
      {initialEvent && <LinkedEventDialog key={initialEvent.id} event={initialEvent} />}
      {isMobile ? panel && <MobileAtlasControls search={panel === "search"} opener={panel === "search" ? searchOpener.current : toolsOpener.current} onClose={() => setPanel(null)}>
        {controls}<TrafficCounter inline />
      </MobileAtlasControls> : <div className="atlas-desktop-controls">{controls}</div>}
      <div className="country-content">
        <nav ref={regionStrip} className="region-chips" aria-label={t("지역 필터")}>
          <Link onClick={() => setPanel(null)} href={href("")} className={!initialRegion ? "active" : ""} aria-current={!initialRegion ? "page" : undefined}>
            {t("전국")}</Link>
          {options.map((item) => (
            <Link onClick={() => setPanel(null)} key={item.code} href={href(item.code)} className={initialRegion === item.code ? "active" : ""} aria-current={initialRegion === item.code ? "page" : undefined}>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="country-heading">
          <p className="eyebrow">{countries[country].english}</p>
          <CountryHeading className="country-heading__name">{t(countries[country].name)}</CountryHeading>
          {!isMobile && <TrafficCounter inline />}
        </div>

        <div className="country-split" aria-busy={pending}>
          <aside className="country-map" aria-label={t("지역 지도")}>
            <EventMap country={country} points={mapPoints} fitToPoints={!!initialRegion} />
            {total > mapPoints.length && <p className="map-help">{t("지도에는 최대 5,000개의 행사만 표시돼요.")}</p>}
          </aside>
          <section id="atlas-catalog" className="country-results" aria-label={t("행사 목록")} hidden={!catalogOpen}>
        {events.length ? (
          <div className="event-grid explorer-grid">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">✳</span>
            <h2>{t("아직 발견하지 못했어요.")}</h2>
          </div>
        )}
        {(page > 1 || page * 24 < total) && <nav className="pagination" aria-label={t("행사 목록 페이지")}>
          {page > 1 && (
            <Link
              className="button button-secondary"
              href={href(initialRegion, page - 1)}
            >
              {t("← 이전")}</Link>
          )}
          {page * 24 < total && (
            <Link
              className="button button-secondary"
              href={href(initialRegion, page + 1)}
            >
              {t("다음 →")}</Link>
          )}
        </nav>}
          </section>
        </div>
      </div>
    </div>
  );
}
