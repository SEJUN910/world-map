"use client";
import { useEffect } from "react";
import { useTranslations } from "@/components/language-provider";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslations();
  useEffect(() => {
    fetch("/api/log-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: error.message, url: location.href, digest: error.digest }),
    }).catch(() => {});
  }, [error]);
  return (
    <main id="main" className="shell empty-state page-empty">
      <h1>{t("잠시 연결이 끊겼어요.")}</h1>
      <p>{t("다시 시도해주세요.")}</p>
      <button className="button" onClick={reset}>
        {t("다시 시도")}</button>
    </main>
  );
}
