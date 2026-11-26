"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { countries, isCountryCode, type CountryCode } from "@/lib/countries";
import { localizedPath } from "@/lib/seo";
import { useTranslations } from "./language-provider";

// variant "row": one line of the phone menu ("🌐 나라 · 대한민국 ›") with the native picker over it.
export function CountrySwitch({ country, heading: Heading = "h1", variant }: { country: CountryCode; heading?: "h1" | "p"; variant?: "row" }) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const select = (className?: string) => <select className={className} aria-label={t("나라 선택")} title={t("나라 선택")} value={country} disabled={pending} onChange={event => {
    const code = event.target.value;
    if (!isCountryCode(code) || code === country) return;
    // Start at the selected country, preserving UI language but clearing the
    // previous country's event, region, search and page parameters.
    startTransition(() => router.push(localizedPath(countries[code].path, locale), { scroll: false }));
  }}>
    {Object.entries(countries).map(([code, item]) => <option key={code} value={code}>{t(item.name)}</option>)}
  </select>;
  if (variant === "row") return <label className="menu-row menu-row--select" aria-busy={pending}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5Z" stroke="currentColor" strokeWidth="1.5" /></svg>
    <span>{t("나라")}</span><strong aria-hidden="true">{t(countries[country].name)}</strong>
    <svg className="menu-row__more" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    {select()}
  </label>;
  return <div className="country-switch" aria-busy={pending}>
    <Heading className="country-switch__heading">{t(countries[country].name)}</Heading>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    {select()}
  </div>;
}
