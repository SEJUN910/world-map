"use client";
import { useTranslations } from "@/components/language-provider";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FestivalEvent } from "@/lib/events";
import { EventCard } from "./event-card";
import { LanguageSelect } from "./language-select";

const PAGE_SIZE = 24;

export function EventClusterDialog({ ids, onDismiss }: { ids: string[]; onDismiss: () => void }) {
  const { t } = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(0);
  const [events, setEvents] = useState<FestivalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const pages = Math.ceil(ids.length / PAGE_SIZE);

  useLayoutEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    element.showModal();
    close.current?.focus({ preventScroll: true });
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = padding;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setLoading(true);
    setError(false);
    const selected = ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    void fetch(`/api/map-posters?ids=${selected.join(",")}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data: FestivalEvent[] = await response.json();
      if (!disposed) {
        const byId = new Map(data.map((event) => [event.id, event]));
        setEvents(selected.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []));
      }
    }).catch(() => { if (!disposed) setError(true); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; controller.abort(); };
  }, [ids, page, retry]);

  return (
    <dialog ref={dialog} className="cluster-dialog" aria-labelledby="cluster-dialog-title"
      onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); onDismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
      <header className="cluster-dialog__header">
        <LanguageSelect />
        <div><h2 id="cluster-dialog-title">{t("이 위치의 행사")}</h2><p>{t("{count}개 행사", { count: ids.length })}</p></div>
        <button ref={close} type="button" className="cluster-dialog__close" aria-label={t("행사 목록 닫기")} onClick={onDismiss}>×</button>
      </header>
      <div className="cluster-dialog__body" aria-busy={loading}>
        {loading ? <p className="cluster-dialog__status" role="status">{t("포스터를 불러오는 중이에요.")}</p>
          : error ? <p className="cluster-dialog__status" role="alert">{t("목록을 불러오지 못했어요.")}<button type="button" onClick={() => setRetry((value) => value + 1)}>{t("다시 시도")}</button></p>
          : events.length ? <div className="cluster-dialog__grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>
          : <p className="cluster-dialog__status">{t("현재 공개된 행사가 없어요.")}</p>}
      </div>
      {pages > 1 && <nav className="cluster-dialog__pagination" aria-label={t("묶인 행사 목록 페이지")}>
        <button type="button" disabled={page === 0 || loading} onClick={() => { setPage((value) => value - 1); dialog.current?.querySelector(".cluster-dialog__body")?.scrollTo(0, 0); }}>{t("이전")}</button>
        <span aria-live="polite">{page + 1} / {pages}</span>
        <button type="button" disabled={page + 1 >= pages || loading} onClick={() => { setPage((value) => value + 1); dialog.current?.querySelector(".cluster-dialog__body")?.scrollTo(0, 0); }}>{t("다음")}</button>
      </nav>}
    </dialog>
  );
}
