"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { analyticsPath } from "@/lib/analytics-path";
import { publicTraffic, type TrafficTotals } from "@/lib/traffic";
import { useTranslations } from "./language-provider";

export function TrafficCounter({ inline = false }: { inline?: boolean }) {
  const pathname = usePathname();
  const visible = analyticsPath(pathname) !== null;
  const { t, locale } = useTranslations();
  const [totals, setTotals] = useState<TrafficTotals | null>(null);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    // Avoid a request for every map movement, filter change or language switch.
    const refresh = () => {
    if (document.visibilityState !== "visible") return;
    fetch("/api/traffic", { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setTotals(publicTraffic(data)); })
      .catch(() => { /* Keep discovery usable if statistics are unavailable. */ });
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [visible]);
  if (!visible || !totals) return null;
  return <aside className={`traffic-counter${inline ? " traffic-counter--inline" : ""}`} aria-label={t("방문·행사 통계")} title={t("한국 시간 기준 · 방문자는 브라우저 추정치 · 조회는 누적 · 약 1분 간격 갱신")}>
    <span>{t("오늘 방문")} <b>{totals.todayVisitors.toLocaleString(locale)}</b></span>
    <span>{t("전체 조회")} <b>{totals.pageViews.toLocaleString(locale)}</b></span>
    <span>{t("행사 조회")} <b>{totals.eventViews.toLocaleString(locale)}</b></span>
  </aside>;
}
