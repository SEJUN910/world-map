"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "./language-provider";
import { SiteTools } from "./site-tools";

// Phone header menu: saved events, account and language in one tap
// (they used to sit inside the sheet's settings panel).
export function MobileMenu() {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} className="mobile-menu">
    <button type="button" className="mobile-menu__toggle" aria-expanded={open} aria-controls={id} aria-label={t("메뉴")} title={t("메뉴")} onClick={() => setOpen((value) => !value)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </button>
    {open && <div id={id} className="mobile-menu__panel"><SiteTools /></div>}
  </div>;
}
