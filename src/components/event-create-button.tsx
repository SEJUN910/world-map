"use client";
import { useTranslations } from "@/components/language-provider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EventForm } from "./event-form";
import type { CountryCode } from "@/lib/countries";
import { eventPath } from "@/lib/events";
import { LanguageSelect } from "./language-select";

type SavedEvent = { countryCode: CountryCode; id: string; slug: string; publicationStatus: "draft" | "published" };

function EventCreateDialog({ opener, onClose, draftId }: {
  opener: React.RefObject<HTMLAnchorElement | null>;
  onClose: () => void;
  draftId?: string;
}) {
  const { t } = useTranslations();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedEvent | null>(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const overflow = document.body.style.overflow;
    const paddingRight = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (element.open) element.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, [opener]);

  return (
    <dialog
      ref={dialog}
      className="create-dialog"
      aria-labelledby="create-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <div className="create-dialog__header">
        <LanguageSelect />
        <h2 id="create-dialog-title">{t("행사 올리기")}</h2>
        <button ref={closeButton} type="button" className="create-dialog__close" onClick={onClose} disabled={saving} aria-label={t("행사 올리기 닫기")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {saved ? (
        <div className="create-dialog__success" role="status">
          <h3>{saved.publicationStatus === "published" ? t("행사를 올렸어요.") : t("비공개로 저장했어요.")}</h3>
          <p>{saved.publicationStatus === "published" ? t("새로운 행사를 함께 발견할 수 있어요.") : t("내 행사에서 이어서 작성할 수 있어요.")}</p>
          <div className="create-dialog__actions">
            <button className="button button-secondary" type="button" onClick={onClose}>{t("닫기")}</button>
            <Link className="button" href={saved.publicationStatus === "published" ? eventPath(saved) : `/me/events/${saved.id}`} onClick={onClose}>
              {saved.publicationStatus === "published" ? t("행사 보기") : t("저장한 행사 보기")}
            </Link>
          </div>
        </div>
      ) : (
        <EventForm modal draftId={draftId} onSavingChange={setSaving} onSaved={(result) => { setSaved(result); router.refresh(); dialog.current?.scrollTo({ top: 0 }); }} />
      )}
    </dialog>
  );
}

export function EventCreateButton({ className = "home-add", draftId, children, openFromQuery = false }: {
  className?: string;
  draftId?: string;
  children?: React.ReactNode;
  openFromQuery?: boolean;
}) {
  const { t } = useTranslations();
  const opener = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<string | undefined>();
  useEffect(() => {
    if (!openFromQuery) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("create") !== "1") return;
    setActiveDraft(url.searchParams.get("draft") || undefined);
    setOpen(true);
    url.searchParams.delete("create");
    url.searchParams.delete("draft");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [openFromQuery]);
  return (
    <>
      <Link ref={opener} className={className} href={draftId ? `/?create=1&draft=${encodeURIComponent(draftId)}` : "/?create=1"} aria-label={draftId ? t("이전 초안 등록하기") : t("행사 올리기")} title={draftId ? t("이전 초안 등록하기") : t("행사 올리기")} onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        setActiveDraft(draftId);
        setOpen(true);
      }}>
        {children ?? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>}
      </Link>
      {open && <EventCreateDialog opener={opener} draftId={activeDraft} onClose={() => setOpen(false)} />}
    </>
  );
}
