"use client";
import { useTranslations } from "@/components/language-provider";
import Link from "next/link";
import { EventCreateButton } from "./event-create-button";

export function MinimalMasthead({ back = false, actions }: { back?: boolean; actions?: React.ReactNode }) {
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
      <Link className="home-wordmark" href="/" aria-label={t("festiva 홈")}>
        festiva<span className="home-brand-mark" aria-hidden="true">✳</span>
      </Link>
      {actions}
      <EventCreateButton openFromQuery />
    </header>
  );
}
