"use client";
import { useTranslations } from "@/components/language-provider";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useTranslations();
  return (
    <main id="main" className="shell empty-state page-empty">
      <h1>{t("잠시 연결이 끊겼어요.")}</h1>
      <p>{t("다시 시도해주세요.")}</p>
      <button className="button" onClick={reset}>
        {t("다시 시도")}</button>
    </main>
  );
}
