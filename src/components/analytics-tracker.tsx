"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendAnalytics, leaveAnalyticsPage } from "@/lib/analytics-client";
import { useTranslations } from "./language-provider";
export function AnalyticsTracker() {
  const pathname = usePathname();
  const { locale } = useTranslations();
  useEffect(() => {
    // A short delay skips Strict Mode's synthetic mount and background preloads.
    const timer = setTimeout(() => sendAnalytics("page_view", locale), 200);
    const visible = () => { if (document.visibilityState === "visible") sendAnalytics("page_view", locale); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [pathname, locale]);
  useEffect(() => { leaveAnalyticsPage(); }, [pathname]);
  return null;
}
