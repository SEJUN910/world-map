"use client";
import { useTranslations } from "@/components/language-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteDraft, readDrafts, type EventDraft } from "@/lib/drafts";
import { eventDate } from "@/lib/events";
import { EventCreateButton } from "./event-create-button";
export function DraftView({ id }: { id?: string }) {
  const { t } = useTranslations();
  const [drafts, setDrafts] = useState<EventDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    try {
      setDrafts(readDrafts());
    } catch {
      setError(t("초안을 불러오지 못했어요. 브라우저 저장 설정을 확인해주세요."));
    } finally {
      setLoaded(true);
    }
  }, []);
  const event = drafts.find((draft) => draft.id === id);
  function remove() {
    if (!id) return;
    try {
      deleteDraft(id);
      setDrafts(readDrafts());
      setConfirm(false);
    } catch {
      setError(t("초안을 삭제하지 못했어요."));
    }
  }
  return (
    <div className="shell drafts-page">
      <Link className="text-link" href={id ? "/me/local-drafts" : "/korea"}>
        ← {id ? t("내 초안") : t("행사 둘러보기")}
      </Link>
      <p className="eyebrow">MY LOCAL DISCOVERIES</p>
      <h1>{id ? t("등록 전, 미리보기.") : t("내가 모아둔 발견.")}</h1>
      <p className="sample-banner">
        {t("이 브라우저에 저장된 초안입니다. 다른 사람에게 공개되지 않으며, 브라우저 데이터를 지우면 삭제됩니다.")}</p>
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      {!loaded ? (
        <p role="status">{t("초안 불러오는 중…")}</p>
      ) : id ? (
        event ? (
          <div className="detail-layout">
            <div className="detail-poster">
              <img
                src={event.poster}
                alt={`${event.title} 포스터`}
                width={480}
                height={680}
              />
            </div>
            <article className="detail-copy">
              <p className="eyebrow">{t("비공개 초안 ·")}{event.region}</p>
              <h2 className="draft-title">{event.title}</h2>
              <dl className="event-facts">
                <div>
                  <dt>{t("일정")}</dt>
                  <dd>{t(eventDate(event))}</dd>
                </div>
                <div>
                  <dt>{t("장소")}</dt>
                  <dd>
                    {event.venue}
                    <br />
                    {event.address}
                  </dd>
                </div>
                <div>
                  <dt>{t("위치")}</dt>
                  <dd>
                    {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}
                  </dd>
                </div>
              </dl>
              <p className="description">
                {event.description || t("아직 소개가 없어요.")}
              </p>
              {/^https?:\/\//i.test(event.officialUrl) && (
                <a
                  className="text-link"
                  href={event.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("공식 링크 ↗")}</a>
              )}
              <div className="form-actions">
                <EventCreateButton
                  className="button button-secondary"
                  draftId={event.id}
                >
                  {t("이전 초안 등록하기")}</EventCreateButton>
              </div>
              <p className="fine-print">
                {t("등록 화면에서 내용을 확인하고 저장할 수 있어요. 기존 브라우저 초안은 유지됩니다.")}</p>
              {confirm ? (
                <div className="delete-confirm">
                  <p>{t("이 초안을 삭제할까요? 삭제 후에는 되돌릴 수 없어요.")}</p>
                  <button className="text-link danger" onClick={remove}>
                    {t("삭제하기")}</button>
                  <button
                    className="text-link"
                    onClick={() => setConfirm(false)}
                  >
                    {t("취소")}</button>
                </div>
              ) : (
                <button
                  className="text-link danger"
                  onClick={() => setConfirm(true)}
                >
                  {t("초안 삭제")}</button>
              )}
            </article>
          </div>
        ) : (
          <div className="empty-state">
            <h2>{t("초안을 찾을 수 없어요.")}</h2>
            <p>{t("저장한 브라우저인지 확인해주세요.")}</p>
            <Link className="button" href="/me/local-drafts">
              {t("내 초안 보기")}</Link>
          </div>
        )
      ) : drafts.length ? (
        <div className="event-grid">
          {drafts.map((draft) => (
            <article key={draft.id} className="event-card">
              <Link href={`/me/local-drafts/${draft.id}`}>
                <div className="poster-frame">
                  <img
                    src={draft.poster}
                    alt={`${draft.title} 포스터`}
                    width={480}
                    height={680}
                  />
                </div>
                <div className="card-meta">
                  <span>{draft.region}</span>
                  <span>{t("비공개 초안")}</span>
                </div>
                <h2>{draft.title}</h2>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">＋</span>
          <h2>{t("첫 발견을 기다리고 있어요.")}</h2>
          <p>{t("포스터 한 장으로 행사를 준비해보세요.")}</p>
          <EventCreateButton className="button">
            {t("행사 올리기 ＋")}</EventCreateButton>
        </div>
      )}
    </div>
  );
}
