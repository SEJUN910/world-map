"use client";
import { useTranslations } from "@/components/language-provider";

import Link from "next/link";
import { useRef, useState } from "react";
import { eventDate, eventPath, type FestivalEvent } from "@/lib/events";
import { EventPosterDialog } from "./event-poster-dialog";
import { SaveEventButton } from "./saved-events";
import { fallBackToOriginal, posterSrc } from "@/lib/poster-image";
export function EventCard({ event, highlighted, onHover, onShowOnMap }: { event: FestivalEvent; highlighted?: boolean; onHover?: (id: string | null) => void; onShowOnMap?: (event: FestivalEvent) => void }) {
  const { t } = useTranslations();
  const link = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <article
      className={`event-card${highlighted ? " is-highlighted" : ""}`}
      data-event-id={event.id}
      onMouseEnter={() => onHover?.(event.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Link ref={link} prefetch={false} href={eventPath(event)} aria-label={`${event.title}, ${event.region}, ${t(eventDate(event))}`} onClick={(click) => {
        if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
        click.preventDefault();
        setOpen(true);
      }}>
        <div className="poster-frame">
          {event.poster ? (
            <img
              src={posterSrc(event.poster, "card")}
              {...fallBackToOriginal(event.poster)}
              alt={`${event.title} ${event.sourceName === "tourapi" ? t("대표 이미지") : t("포스터")}`}
              className={event.sourceName === "tourapi" ? "source-image" : undefined}
              width={480}
              height={680}
              loading="lazy"
            />
          ) : (
            <span className="poster-placeholder">{t("포스터 준비 중")}</span>
          )}
          <span className="poster-overlay" aria-hidden="true">
            <span className="poster-overlay__hint">{t("자세히 보기 ↗")}</span>
            <span className="poster-overlay__details">
              <strong>{event.title}</strong>
              <span>{event.region}</span>
              <span>{t(eventDate(event))}</span>
            </span>
          </span>
        </div>
        <div className="card-meta">
          <span>{event.region}</span>
          <span>{t(eventDate(event))}</span>
        </div>
        <h3>{event.title}</h3>
      </Link>
      <SaveEventButton id={event.id} />
      {open && <EventPosterDialog event={event} opener={link} onDismiss={() => setOpen(false)} onShowOnMap={onShowOnMap && ((target) => { setOpen(false); onShowOnMap(target); })} />}
    </article>
  );
}
