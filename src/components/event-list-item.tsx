"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { eventBadge, eventDate, eventPath, todayInCountry, type FestivalEvent } from "@/lib/events";
import { useTranslations } from "./language-provider";
import { EventPosterDialog } from "./event-poster-dialog";
import { SaveEventButton } from "./saved-events";
import { CATEGORY_LABELS } from "@/lib/event-categories";
import { fallBackToOriginal, posterSrc } from "@/lib/poster-image";

// One row of the list view (mobile sheet and desktop list): thumbnail, progress
// badge, title, dates and place, with save and "show on map" actions.
export function EventListItem({ event, selected = false, highlighted = false, onHover, onOpen, onShowOnMap, distance }: {
  event: FestivalEvent;
  selected?: boolean;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
  onOpen?: (event: FestivalEvent) => void;
  onShowOnMap?: (event: FestivalEvent) => void;
  /** "Near me" distance, already formatted ("850m"). */
  distance?: string;
}) {
  const { t } = useTranslations();
  const link = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const badge = eventBadge(event, todayInCountry(event.countryCode || "kr"));
  const place = [event.venue, event.address].filter(Boolean).join(" · ");
  const showOnMap = onShowOnMap && ((target: FestivalEvent) => { setOpen(false); onShowOnMap(target); });
  return <article className={`event-row${selected ? " is-selected" : ""}${highlighted ? " is-highlighted" : ""}`} data-event-id={event.id}
    onMouseEnter={onHover && (() => onHover(event.id))} onMouseLeave={onHover && (() => onHover(null))}>
    <Link ref={link} prefetch={false} href={eventPath(event)} className="event-row__body" onClick={(click) => {
      if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
      click.preventDefault();
      onOpen?.(event);
      setOpen(true);
    }}>
      <span className="event-row__thumb">
        {event.poster
          ? <img src={posterSrc(event.poster, "thumb")} {...fallBackToOriginal(event.poster)} alt="" width={84} height={112} loading="lazy" className={event.sourceName === "tourapi" ? "source-image" : undefined} />
          : <span className="poster-placeholder">{t("포스터 준비 중")}</span>}
      </span>
      <span className="event-row__text">
        <span className="event-row__meta">
          {badge && <span className={`event-badge event-badge--${badge.tone}`} suppressHydrationWarning>{t(badge.label, badge.values)}</span>}
          {event.category && event.category !== "other" && <span className="event-row__category">{t(CATEGORY_LABELS[event.category])}</span>}
          {event.region && <span>{event.region}</span>}
          {distance && <span className="event-row__distance">{t("약 {distance}", { distance })}</span>}
        </span>
        <strong className="event-row__title" lang={event.sourceName === "paris_qfap" ? "fr" : undefined}>{event.title}</strong>
        <span className="event-row__date">{t(eventDate(event))}</span>
        {place && <span className="event-row__place">{place}</span>}
      </span>
    </Link>
    <div className="event-row__actions">
      <SaveEventButton id={event.id} />
      {showOnMap && <button type="button" className="event-row__map" aria-label={t("지도에서 보기")} title={t("지도에서 보기")} onClick={() => showOnMap(event)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>}
    </div>
    {open && <EventPosterDialog event={event} opener={link} onDismiss={() => setOpen(false)} onShowOnMap={showOnMap} />}
  </article>;
}
