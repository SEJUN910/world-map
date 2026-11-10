"use client";
import { useTranslations } from "@/components/language-provider";
import Link from "next/link";
export default function NotFound() {
  const { t } = useTranslations();
  return (
    <main id="main" className="shell empty-state page-empty">
      <p className="eyebrow">404 · NOT FOUND</p>
      <h1>{t("이 발견은 아직 없어요.")}</h1>
      <p>{t("주소를 확인하거나 다른 행사를 둘러보세요.")}</p>
      <Link className="button" href="/korea">
        {t("행사 둘러보기 ↗")}</Link>
    </main>
  );
}
