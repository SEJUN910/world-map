"use client";
import { useTranslations } from "@/components/language-provider";
import Link from "next/link";
import { EventCreateButton } from "./event-create-button";

export function MinimalMasthead({ back = false, actions, after }: { back?: boolean; actions?: React.ReactNode; after?: React.ReactNode }) {
  const { t } = useTranslations();
  return (
    <header className="home-masthead">
      {back && (
        <Link className="home-back" href="/" aria-label={t("지구본으로 돌아가기")} title={t("뒤로가기")}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path d="m14 6-6 6 6 6M8 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <Link className="home-wordmark" href="/" aria-label={t("루크맵 홈")}>
        LukeMap<span className="home-brand-mark" aria-hidden="true">✳</span>
      </Link>
      {actions}
      <EventCreateButton openFromQuery className={back ? "home-add" : "home-add home-add--labeled"}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        {!back && <span className="home-add__label">{t("행사 올리기")}</span>}
      </EventCreateButton>
      {after}
    </header>
  );
}
