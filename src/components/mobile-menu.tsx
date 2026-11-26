"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CountryCode } from "@/lib/countries";
import { useTranslations } from "./language-provider";
import { CountrySwitch } from "./country-switch";
import { AccountControl } from "./account-control";
import { SavedEventsLink } from "./saved-events";

// Phone menu inside the floating search bar: everything that is not searching
// or filtering, as one list of rows — country, post an event, saved events, account.
export function MobileMenu({ country, onCreate }: { country: CountryCode; onCreate: () => void }) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false); };
    // Escape inside an open dialog (account) belongs to that dialog.
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector("dialog[open]")) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} className="mobile-menu">
    <button type="button" className="mobile-menu__toggle" aria-expanded={open} aria-controls={id} aria-label={t("메뉴")} title={t("메뉴")} onClick={() => setOpen((value) => !value)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </button>
    {/* On <body>: the page is its own stacking context, so a panel inside it would sit under the list sheet. */}
    {open && createPortal(<div ref={panel} id={id} className="mobile-menu__panel">
      <CountrySwitch country={country} variant="row" />
      <button type="button" className="menu-row mobile-menu__add" onClick={() => { setOpen(false); onCreate(); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <span>{t("행사 올리기")}</span>
      </button>
      <SavedEventsLink variant="row" />
      <AccountControl />
    </div>, document.body)}
  </div>;
}
