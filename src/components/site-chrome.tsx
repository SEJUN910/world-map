"use client";
import { useTranslations } from "@/components/language-provider";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { AnalyticsTracker } from "./analytics-tracker";
import { SiteTools } from "./site-tools";
import { TrafficCounter } from "./traffic-counter";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const { t } = useTranslations();
  const pathname = usePathname();
  const isHome = pathname === "/" || pathname === "/korea" || pathname === "/taiwan" || pathname.startsWith("/regions/");
  const isAtlas = pathname === "/korea" || pathname === "/taiwan" || pathname.startsWith("/regions/");
  return (
    <>
      <AnalyticsTracker />
      {pathname === "/" && <TrafficCounter />}
      {!isAtlas && <SiteTools />}
      {!isHome && <Header />}
      {children}
      {!isHome && (
        <footer className="site-footer">
          <span className="footer-brand">festiva ✳</span>
          <span>{t("작은 행사에도, 발견되는 순간을.")}</span>
          <span>{t("우리 동네의 축제와 행사")}</span>
        </footer>
      )}
    </>
  );
}
