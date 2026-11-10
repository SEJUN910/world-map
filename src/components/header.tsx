"use client";
import { useTranslations } from "@/components/language-provider";
import Link from "next/link";
import { EventCreateButton } from "./event-create-button";
export function Header() {
  const { t } = useTranslations();
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label={t("festiva 홈")}>
        festiva<span>✳</span>
      </Link>
      <nav aria-label={t("주 메뉴")}>
        <Link href="/korea">{t("행사 둘러보기")}</Link>
        <Link href="/me/events">{t("내 행사")}</Link>
        <EventCreateButton className="button button-small">
          {t("행사 올리기")}<span aria-hidden="true">＋</span>
        </EventCreateButton>
      </nav>
    </header>
  );
}
