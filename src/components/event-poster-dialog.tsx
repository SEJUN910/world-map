"use client";
import { EventDetailActions } from "./event-detail-actions";
import { useTranslations } from "@/components/language-provider";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sendAnalytics } from "@/lib/analytics-client";
import { eventDate, type FestivalEvent } from "@/lib/events";
import { ReportEvent } from "./event-controls";
import { useRouter } from "next/navigation";
import { RichTextView } from "./rich-text-view";
import { LanguageSelect } from "./language-select";
import { SaveEventButton, ShareEventButton } from "./saved-events";

export function LinkedEventDialog({ event }: { event: FestivalEvent }) {
  const opener = useRef<HTMLAnchorElement | null>(null);
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return <EventPosterDialog initiallyOpen event={event} opener={opener} onDismiss={() => {
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }} />;
}

export function EventPosterDialog({ event, opener, onDismiss, initiallyOpen = false, onShowOnMap }: {
  initiallyOpen?: boolean;
  onShowOnMap?: (event: FestivalEvent) => void;
  event: FestivalEvent;
  opener: React.RefObject<HTMLAnchorElement | null>;
  onDismiss: () => void;
}) {
  const { t, locale } = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => sendAnalytics("event_view", locale, event.id), 250);
    return () => clearTimeout(timer);
  }, [event.id, locale]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    if (element.open) element.close();
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (element.open) element.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, [opener]);

  const isTourImage = event.sourceName === "tourapi";
  const isParis = event.sourceName === "paris_qfap";
  // Paris listings are shown in the original French.
  const textLang = isParis ? "fr" : undefined;
  const Title = initiallyOpen ? "h1" : "h2";
  return (
    <dialog open={initiallyOpen || undefined} ref={dialog} className="poster-modal" aria-label={event.title}
      onCancel={(e) => { e.preventDefault(); onDismiss(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}>
      <div className="poster-modal__panel">
            <div className="poster-modal__header">
              <LanguageSelect />
            </div>
            <div className="poster-modal__image">
              {event.poster ? <img src={event.poster} alt={`${event.title} ${isTourImage ? t("대표 이미지") : t("포스터")}`} width={480} height={680} /> : <p>{t("포스터 준비 중")}</p>}
              {event.sourceImageCredit && <p className="poster-modal__credit">{t("사진:")} {event.sourceImageCredit}</p>}
            </div>
            <div className="poster-modal__info">
              <p className="poster-modal__eyebrow">{event.region} <span aria-hidden="true">✳</span></p>
              <Title id={`poster-title-${event.id}`} lang={textLang}>{event.title}</Title>
              {event.eventStatus && event.eventStatus !== "scheduled" && (
                <p className="poster-modal__status">{event.eventStatus === "cancelled" ? t("취소된 행사입니다.") : t("연기된 행사입니다.")}</p>
              )}
              <dl className="poster-modal__facts">
                <div><dt>{t("일정")}</dt><dd>{t(eventDate(event))}</dd></div>
                {(event.venue || event.address) && <div><dt>{t("장소")}</dt><dd>{event.venue}{event.address && <small>{event.address}</small>}</dd></div>}
                {event.region && <div><dt>{t("지역")}</dt><dd>{event.region}</dd></div>}
              </dl>
              <EventDetailActions key={event.id} event={event} />
              {/* Some imported listings carry no description; the official link covers them. */}
              {(event.description.trim() || event.descriptionContent) && <div className="poster-modal__description" lang={textLang}>
                <h3>{t("행사 소개")}</h3>
                <RichTextView content={event.descriptionContent} text={event.description} />
              </div>}
              {event.sourceName && event.sourceUrl && (
                <p className="poster-modal__source">
                  {t("이미지·행사 정보:")}{" "}<a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{isTourImage ? t("한국관광공사 TourAPI") : event.sourceName === "taiwan_tourism" ? "Taiwan Tourism Administration" : isParis ? "Que faire à Paris (Ville de Paris)" : event.sourceName === "kcisa_culture" ? t("문화포털 한눈에보는문화정보") : t("공공데이터포털")} ↗</a>
                  {event.sourceProvider && <> {t("· 제공:")} {event.sourceProvider}</>}
                  {event.sourceImageLicense === "OGDL-1.0" && <> · <a href="https://data.gov.tw/license" target="_blank" rel="noopener noreferrer">Open Government Data License 1.0</a></>}
                  {event.sourceImageLicense === "ODbL" && <> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">Open Database License (ODbL)</a></>}
                  {event.sourceImageLicense === "NO_RESTRICTION" && <> {t("· 이용허락범위 제한 없음")}</>}
                  {event.sourceImageLicense && !["OGDL-1.0", "ODbL", "NO_RESTRICTION"].includes(event.sourceImageLicense) && <> {t("· 공공누리")} {event.sourceImageLicense === "Type3" ? t("제3유형 (출처표시·변경금지)") : t("제1유형 (출처표시)")}</>}
                  {event.sourceReferenceDate && <> {t("· 기준일")} {event.sourceReferenceDate}</>}
                </p>
              )}
              <div className="poster-modal__actions">
                <SaveEventButton id={event.id} variant="label" />
                <ShareEventButton event={event} />
                {onShowOnMap && <button type="button" className="share-event__button" onClick={() => onShowOnMap(event)}>{t("지도에서 보기")}</button>}
                {event.officialUrl && <a href={event.officialUrl} target="_blank" rel="noopener noreferrer">{t("공식 안내 ↗")}</a>}
              </div>
              <ReportEvent id={event.id} />
            </div>
        <button ref={closeButton} className="poster-modal__close" type="button" onClick={onDismiss} aria-label={t("행사 소개 닫기")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
    </dialog>
  );
}
