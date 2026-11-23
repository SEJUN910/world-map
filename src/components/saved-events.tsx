"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAccount } from "./account-provider";
import { useTranslations } from "./language-provider";
import { ensureVisitorSession } from "@/lib/supabase/browser-visitor";
import { removeSavedEventsAction, setSavedEventAction } from "@/app/actions/saved-events";
import { eventDate, type FestivalEvent } from "@/lib/events";
import { eventShareUrl } from "@/lib/saved-events";

type SavedEvents = {
  saved: ReadonlySet<string>;
  toggle: (id: string) => Promise<void>;
  remove: (ids: string[]) => Promise<boolean>;
};
const Context = createContext<SavedEvents>({ saved: new Set(), toggle: async () => {}, remove: async () => false });
export function useSavedEvents() { return useContext(Context); }

// One source of truth for every save button (cards, sheet, modal, /me/saved),
// so toggling in one place updates the others immediately.
export function SavedEventsProvider({ initialIds, children }: { initialIds: string[]; children: React.ReactNode }) {
  const { t } = useTranslations();
  const { account } = useAccount();
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set(initialIds));
  const current = useRef(saved);
  const busy = useRef(new Set<string>());
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const update = useCallback((next: ReadonlySet<string>) => { current.current = next; setSaved(next); }, []);
  const initialKey = initialIds.join(",");
  // Server refreshes (navigation, revalidation) carry the authoritative list,
  // except for toggles still in flight: keep their optimistic value.
  useEffect(() => {
    const next = new Set(initialKey ? initialKey.split(",") : []);
    for (const id of busy.current) {
      if (current.current.has(id)) next.add(id); else next.delete(id);
    }
    update(next);
  }, [initialKey, update]);
  // Signing out leaves no identity, so nothing is saved any more.
  useEffect(() => { if (!account) update(new Set()); }, [account, update]);
  // Saves often happen inside a modal <dialog>, which makes the rest of the
  // page inert. Render the toast inside the top-most modal so it stays visible,
  // clickable and announced.
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    let modal: Element | null = null;
    try { const modals = document.querySelectorAll("dialog:modal"); modal = modals[modals.length - 1] ?? null; } catch { /* no :modal support */ }
    setHost(notice ? modal : null);
    if (!notice) return;
    // If that dialog closes while the toast is showing, move it back to <body>.
    const back = () => setHost(null);
    modal?.addEventListener("close", back);
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => { clearTimeout(timer); modal?.removeEventListener("close", back); };
  }, [notice]);

  const toggle = useCallback(async (id: string) => {
    if (busy.current.has(id)) return;
    busy.current.add(id);
    const save = !current.current.has(id);
    const optimistic = new Set(current.current);
    if (save) optimistic.add(id); else optimistic.delete(id);
    update(optimistic);
    try {
      if (save) await ensureVisitorSession();
      const result = await setSavedEventAction(id, save);
      if (result.error) throw new Error(result.error);
      setNotice({ text: t(save ? "관심 행사에 담았어요." : "관심 행사에서 뺐어요."), error: false });
    } catch (error) {
      const rollback = new Set(current.current);
      if (save) rollback.delete(id); else rollback.add(id);
      update(rollback);
      setNotice({ text: t(error instanceof Error && error.message ? error.message : "관심 행사로 저장하지 못했어요. 공개 중인 행사인지 확인해주세요."), error: true });
    } finally {
      busy.current.delete(id);
    }
  }, [t, update]);

  const remove = useCallback(async (ids: string[]) => {
    if (!ids.length) return true;
    try {
      const result = await removeSavedEventsAction(ids);
      if (result.error) throw new Error(result.error);
      const next = new Set(current.current);
      for (const id of ids) next.delete(id);
      update(next);
      return true;
    } catch (error) {
      setNotice({ text: t(error instanceof Error && error.message ? error.message : "목록을 정리하지 못했어요. 다시 시도해주세요."), error: true });
      return false;
    }
  }, [t, update]);

  const toast = <p className={`saved-toast${notice ? " is-visible" : ""}${notice?.error ? " is-error" : ""}`} role="status">
    {notice?.text}{notice && !notice.error && <> <Link href="/me/saved">{t("관심 행사 보기")}</Link></>}
  </p>;
  return <Context.Provider value={{ saved, toggle, remove }}>
    {children}
    {host?.isConnected ? createPortal(toast, host) : toast}
  </Context.Provider>;
}

function BookmarkIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>;
}

export function SaveEventButton({ id, variant = "icon", className = "" }: { id: string; variant?: "icon" | "label"; className?: string }) {
  const { t } = useTranslations();
  const { saved, toggle } = useSavedEvents();
  const isSaved = saved.has(id);
  const label = t(isSaved ? "관심 행사에서 빼기" : "관심 행사로 저장");
  return <button type="button" className={`save-toggle save-toggle--${variant}${isSaved ? " is-saved" : ""} ${className}`.trim()}
    aria-pressed={isSaved} aria-label={variant === "icon" ? label : undefined} title={label}
    onClick={(click) => { click.preventDefault(); click.stopPropagation(); void toggle(id); }}>
    <BookmarkIcon filled={isSaved} />
    {variant === "label" && <span>{t(isSaved ? "저장됨" : "관심 행사 저장")}</span>}
  </button>;
}

export function SavedEventsLink() {
  const { t } = useTranslations();
  const { saved } = useSavedEvents();
  const label = saved.size ? t("관심 행사 {count}개", { count: saved.size }) : t("관심 행사");
  return <Link href="/me/saved" className="site-tools__saved" aria-label={label} title={label}>
    <BookmarkIcon filled={!!saved.size} size={17} />
    {!!saved.size && <small aria-hidden="true">{saved.size > 99 ? "99+" : saved.size}</small>}
  </Link>;
}

export function ShareEventButton({ event }: { event: FestivalEvent }) {
  const { t, locale } = useTranslations();
  // navigator.share is client-only; decide after hydration to keep SSR markup stable.
  const [native, setNative] = useState(false);
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState("");
  useEffect(() => { setNative(typeof navigator.share === "function"); }, []);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(timer);
  }, [status]);
  async function share() {
    const url = eventShareUrl(window.location.origin, event, locale);
    setManual("");
    if (native) {
      try {
        await navigator.share({ title: event.title, text: `${event.title} · ${t(eventDate(event))}`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus(t("링크를 복사했어요."));
    } catch {
      setManual(url);
    }
  }
  return <div className="share-event">
    <button type="button" className="share-event__button" onClick={() => void share()}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {native
          ? <path d="M12 15V4m0 0-4 4m4-4 4 4M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
      </svg>
      <span>{t(native ? "공유" : "링크 복사")}</span>
    </button>
    <span className="share-event__status" role="status">{status}</span>
    {manual && <label className="share-event__manual">{t("이 링크를 복사해 공유하세요")}
      <input readOnly value={manual} autoFocus onFocus={(focus) => focus.currentTarget.select()} />
    </label>}
  </div>;
}
