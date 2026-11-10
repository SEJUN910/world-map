import type { Metadata } from "next";
import { SiteChrome } from "@/components/site-chrome";
import { siteUrl } from "@/lib/site";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { LanguageProvider } from "@/components/language-provider";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AccountProvider, type Account } from "@/components/account-provider";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = await getLocale();
  return {
  applicationName: "festiva",
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, other: process.env.NAVER_SITE_VERIFICATION ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION } : undefined },
  metadataBase: new URL(siteUrl),
  title: {
    default: t("festiva — 지도로 만나는 우리 동네 행사"),
    template: "%s | festiva",
  },
  description:
    t("작은 동네 행사부터 지역 축제까지. 지도에서 발견하고, 포스터 한 장으로 나누세요."),
  openGraph: { type: "website", locale: locale === "ko" ? "ko_KR" : locale === "en" ? "en_US" : "zh_TW", siteName: "festiva" },
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = await getTranslations();
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  const account:Account=user?{id:user.id,name:typeof user.user_metadata?.full_name==="string"?user.user_metadata.full_name.slice(0,80):"",anonymous:!!user.is_anonymous}:null;
  return (
    <html lang={locale}>
      <body>
        <a href="#main" className="skip-link">
          {t("본문으로 건너뛰기")}
        </a>
        <LanguageProvider initialLocale={locale}><AccountProvider initialAccount={account} googleReady={process.env.GOOGLE_AUTH_ENABLED==="true"}><SiteChrome>{children}</SiteChrome></AccountProvider></LanguageProvider>
      </body>
    </html>
  );
}
