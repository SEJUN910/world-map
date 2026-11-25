"use client";
import { useId, useState } from "react";
import { eventDate, todayInCountry, type FestivalEvent } from "@/lib/events";
import { eventShareUrl } from "@/lib/saved-events";
import { calendarPlan, directionsLinks, googleCalendarUrl, icsFile } from "@/lib/event-actions";
import { useTranslations } from "./language-provider";

// Directions and "add to calendar" in the event detail, right under the facts.
// Each opens an inline row (a popover would be clipped by the scrolling dialog);
// opening one closes the other.
export function EventDetailActions({ event }: { event: FestivalEvent }) {
  const { t, locale } = useTranslations();
  const id = useId();
  const [open, setOpen] = useState<"" | "directions" | "calendar">("");
  const links = directionsLinks(event, locale);
  const plan = calendarPlan(event, todayInCountry(event.countryCode || "kr"));
  const [day, setDay] = useState(plan.kind === "pick" ? plan.min : "");
  if (!links.length && plan.kind === "none") return null;

  const range = plan.kind === "range" ? { start: plan.start, end: plan.end } : plan.kind === "pick" && day >= plan.min && day <= plan.max ? { start: day, end: day } : null;
  const shareUrl = () => eventShareUrl(window.location.origin, event, locale);
  const details = (url: string) => [`${t("일정")}: ${t(eventDate(event))}`, url, event.officialUrl ? `${t("공식 안내 ↗")} ${event.officialUrl}` : ""].filter(Boolean).join("\n");
  function download() {
    if (!range) return;
    const url = shareUrl();
    const blob = new Blob([icsFile(event, range.start, range.end, details(url), url)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `festiva-${event.id.slice(0, 8)}.ics`;
    document.body.appendChild(link); link.click(); link.remove();
    // Generous delay: a slow download (or a webview asking first) must not lose the file.
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }
  const toggle = (next: "directions" | "calendar") => setOpen((value) => value === next ? "" : next);
  return <div className="detail-actions">
    <div className="detail-actions__buttons">
      {links.length === 1
        ? <a className="share-event__button" href={links[0].href} target="_blank" rel="noopener noreferrer">{t("길찾기")} ↗</a>
        : links.length > 1 && <button type="button" className="share-event__button" aria-expanded={open === "directions"} aria-controls={`${id}-directions`} onClick={() => toggle("directions")}>{t("길찾기")}</button>}
      {plan.kind !== "none" && <button type="button" className="share-event__button" aria-expanded={open === "calendar"} aria-controls={`${id}-calendar`} onClick={() => toggle("calendar")}>{t("캘린더에 추가")}</button>}
    </div>
    {open === "directions" && <div id={`${id}-directions`} className="detail-actions__panel">
      {links.map((link) => <a key={link.service} href={link.href} target="_blank" rel="noopener noreferrer">{t(link.label)} ↗</a>)}
    </div>}
    {open === "calendar" && plan.kind !== "none" && <div id={`${id}-calendar`} className="detail-actions__panel">
      {plan.kind === "pick" && <label className="detail-actions__day">{t("방문할 날")}
        <input type="date" value={day} min={plan.min} max={plan.max} required onChange={(change) => setDay(change.target.value)} />
      </label>}
      {range
        ? <>
          <a href={googleCalendarUrl(event, range.start, range.end, details(typeof window === "undefined" ? "" : shareUrl()))} target="_blank" rel="noopener noreferrer">{t("Google 캘린더")} ↗</a>
          <button type="button" onClick={download}>{t("일정 파일 (.ics)")}</button>
        </>
        : <p role="alert">{t("행사 기간 안의 날짜를 골라주세요.")}</p>}
    </div>}
  </div>;
}
