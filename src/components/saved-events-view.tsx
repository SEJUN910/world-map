"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FestivalEvent } from "@/lib/events";
import { EventCard } from "./event-card";
import { useTranslations } from "./language-provider";
import { useSavedEvents } from "./saved-events";
import { useAccount } from "./account-provider";
import { GoogleSubmit } from "./account-control";
import { startGoogleAuth } from "@/app/actions/auth";

export function SavedEventsView({ active, ended, unavailableIds, member }: {
  active: FestivalEvent[];
  ended: FestivalEvent[];
  unavailableIds: string[];
  member: boolean;
}) {
  const { t } = useTranslations();
  const router = useRouter();
  const { saved, remove } = useSavedEvents();
  const { googleReady } = useAccount();
  const [busy, setBusy] = useState(false);
  // Unsaving from a card or modal hides it here at once, before any refresh.
  const current = active.filter((event) => saved.has(event.id));
  const past = ended.filter((event) => saved.has(event.id));
  const unavailable = unavailableIds.filter((id) => saved.has(id));
  async function clear(ids: string[]) {
    setBusy(true);
    if (await remove(ids)) router.refresh();
    setBusy(false);
  }
  if (!member) return <div className="empty-state saved-page__login">
    <h2>{t("로그인하고 관심 행사를 모아 보세요.")}</h2>
    <p>{t("Google로 로그인하면 관심 행사를 저장하고 어느 기기에서나 볼 수 있어요. 처음이면 자동으로 가입됩니다.")}</p>
    <form action={startGoogleAuth}><input type="hidden" name="next" value="/me/saved" /><GoogleSubmit disabled={!googleReady} /></form>
    {!googleReady && <p className="fine-print" role="status">{t("구글 로그인을 준비 중이에요.")}</p>}
  </div>;
  return <>
    {!!unavailable.length && <div className="saved-page__notice" role="status">
      <p>{t("공개가 중단되거나 삭제된 행사 {count}건이 있어요.", { count: unavailable.length })}</p>
      <button type="button" className="text-link" disabled={busy} onClick={() => void clear(unavailable)}>{t("목록에서 정리")}</button>
    </div>}
    {current.length ? <section aria-labelledby="saved-active">
      <h2 id="saved-active" className="saved-page__heading">{t("진행 중·예정")} <small>{current.length}</small></h2>
      <div className="event-grid">{current.map((event) => <EventCard key={event.id} event={event} />)}</div>
    </section> : !past.length && <div className="empty-state">
      <h2>{t("아직 저장한 행사가 없어요.")}</h2>
      <p>{t("지도에서 마음에 드는 행사의 북마크를 눌러 모아 보세요.")}</p>
      <div className="form-actions">
        <Link className="button" href="/korea">{t("한국 행사 둘러보기")}</Link>
        <Link className="button button-secondary" href="/taiwan">{t("대만 행사 둘러보기")}</Link>
        <Link className="button button-secondary" href="/france">{t("프랑스 행사 둘러보기")}</Link>
      </div>
    </div>}
    {!!past.length && <section aria-labelledby="saved-ended" className="saved-page__ended">
      <div className="saved-page__heading-row">
        <h2 id="saved-ended" className="saved-page__heading">{t("종료된 행사")} <small>{past.length}</small></h2>
        <button type="button" className="text-link" disabled={busy} onClick={() => void clear(past.map((event) => event.id))}>{t("종료된 행사 모두 정리")}</button>
      </div>
      <div className="event-grid">{past.map((event) => <EventCard key={event.id} event={event} />)}</div>
    </section>}
  </>;
}
