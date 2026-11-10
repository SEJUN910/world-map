import { Globe } from "@/components/globe";
import { MinimalMasthead } from "@/components/minimal-masthead";
import { listEventMapPoints } from "@/lib/event-repository";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { absoluteUrl, localizedPath, pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const t = await getTranslations(); return pageMetadata({ title: t("festiva — 지도로 만나는 우리 동네 행사"), description: t("작은 동네 행사부터 지역 축제까지. 지도에서 발견하고, 포스터 한 장으로 나누세요."), path: "/", locale: await getLocale() }); }

export default async function Home() {
  const points = await listEventMapPoints();
  const locale = await getLocale();
  return (
    <main id="main" className="minimal-home">
      <h1 className="visually-hidden">festiva</h1>
      <StructuredData value={{ "@context": "https://schema.org", "@type": "WebSite", name: "festiva", url: absoluteUrl("/"), inLanguage: ["ko", "en", "zh-TW"] }} />
      <noscript><nav className="no-script-countries" aria-label="Countries"><a href={localizedPath("/korea", locale)}>South Korea</a><a href={localizedPath("/taiwan", locale)}>Taiwan</a></nav></noscript>
      <MinimalMasthead />
      <Globe points={points} />
    </main>
  );
}
