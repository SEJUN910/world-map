"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { eventDate, eventPath, type FestivalEvent } from "@/lib/events";
import { fallBackToOriginal, posterSrc } from "@/lib/poster-image";
import { useTranslations } from "./language-provider";
import { EventPosterDialog } from "./event-poster-dialog";

// Horizontal strip of picks above the phone list (this weekend's events with a
// poster). Chosen by date only — nothing here is paid placement.
export function FeaturedStrip({ events, onShowOnMap }: { events: FestivalEvent[]; onShowOnMap?: (event: FestivalEvent) => void }) {
  const { t } = useTranslations();
  const [open, setOpen] = useState<FestivalEvent | null>(null);
  const opener = useRef<HTMLAnchorElement | null>(null);
  const heading = useId();
  if (events.length < 3) return null;
  return <section className="featured-strip" aria-labelledby={heading}>
    <h2 id={heading}>{t("이번 주말 가볼 만한 행사")}</h2>
    <ul>
      {events.map((event) => <li key={event.id}>
        <Link prefetch={false} href={eventPath(event)} onClick={(click) => {
          if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
          click.preventDefault();
          opener.current = click.currentTarget;
          setOpen(event);
        }}>
          <img src={posterSrc(event.poster, "thumb")} {...fallBackToOriginal(event.poster)} alt="" width={132} height={84} loading="lazy" />
          <strong lang={event.sourceName === "paris_qfap" ? "fr" : undefined}>{event.title}</strong>
          <span>{t(eventDate(event))}</span>
        </Link>
      </li>)}
    </ul>
    {open && <EventPosterDialog event={open} opener={opener} onDismiss={() => setOpen(null)}
      onShowOnMap={onShowOnMap && ((target) => { setOpen(null); onShowOnMap(target); })} />}
  </section>;
}
