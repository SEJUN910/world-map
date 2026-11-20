"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { countries, isCountryCode, type CountryCode } from "@/lib/countries";
import { localizedPath } from "@/lib/seo";
import { useTranslations } from "./language-provider";

export function CountrySwitch({ country, heading: Heading = "h1" }: { country: CountryCode; heading?: "h1" | "p" }) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="country-switch" aria-busy={pending}>
    <Heading className="country-switch__heading">{t(countries[country].name)}</Heading>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <select aria-label={t("나라 선택")} title={t("나라 선택")} value={country} disabled={pending} onChange={event => {
      const code = event.target.value;
      if (!isCountryCode(code) || code === country) return;
      // Start at the selected country, preserving UI language but clearing the
      // previous country's event, region, search and page parameters.
      startTransition(() => router.push(localizedPath(countries[code].path, locale), { scroll: false }));
    }}>
      {Object.entries(countries).map(([code, item]) => <option key={code} value={code}>{t(item.name)}</option>)}
    </select>
  </div>;
}
