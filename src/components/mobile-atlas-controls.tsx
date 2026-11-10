"use client";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "./language-provider";

const query = "(max-width: 700px)";
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function useMobileAtlas() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

export function MobileAtlasControls({ search, opener, onClose, children }: {
  search: boolean;
  opener: HTMLButtonElement | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const el = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    const target = el.querySelector<HTMLElement>(search ? 'input[type="search"]' : ".atlas-mobile-panel__close");
    target?.focus();
    return () => {
      if (el.open) el.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [opener, search]);
  return <dialog ref={dialog} id="atlas-mobile-controls" className="atlas-mobile-panel" aria-label={t("검색 및 지도 설정")}
    onKeyDown={event => {
      // Search inputs consume Escape to clear text. Close this panel explicitly,
      // while letting a nested account dialog handle its own Escape first.
      if (event.key !== "Escape" || (event.target as Element).closest("dialog") !== event.currentTarget) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }}
    onCancel={event => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onClose();
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <div className="atlas-mobile-panel__header"><span>festiva ✳</span><button className="atlas-mobile-panel__close" type="button" onClick={onClose} aria-label={t("닫기")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    </button></div>
    {children}
  </dialog>;
}
