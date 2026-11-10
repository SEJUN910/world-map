"use client";
import { useTranslations } from "@/components/language-provider";

import Link from "next/link";
import { useRef, useState } from "react";
import { eventDate, eventPath, type FestivalEvent } from "@/lib/events";
import { EventPosterDialog } from "./event-poster-dialog";
export function EventCard({ event }: { event: FestivalEvent }) {
  const { t } = useTranslations();
  const link = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <article className="event-card">
      <Link ref={link} prefetch={false} href={eventPath(event)} aria-label={`${event.title}, ${event.region}, ${t(eventDate(event))}`} onClick={(click) => {
        if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
        click.preventDefault();
        setOpen(true);
      }}>
        <div className="poster-frame">
          {event.poster ? (
            <img
              src={event.poster}
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
      {open && <EventPosterDialog event={event} opener={link} onDismiss={() => setOpen(false)} />}
    </article>
  );
}
