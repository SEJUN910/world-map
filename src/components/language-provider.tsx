"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isLocale, languageCookie, translate, type Locale, type Translator } from "@/lib/i18n";
const LanguageContext = createContext<{ locale: Locale; t: Translator; setLocale: (locale: Locale) => void } | null>(null);
export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const explicitLocale = useSearchParams().get("lang");
  const [locale, updateLocale] = useState(initialLocale);
  const current = useRef(locale);
  current.current = locale;
  useEffect(() => { updateLocale(initialLocale); document.documentElement.lang = initialLocale; }, [initialLocale]);
  useEffect(() => {
    if (!isLocale(explicitLocale)) return;
    updateLocale(explicitLocale);
    document.documentElement.lang = explicitLocale;
    document.cookie = `${languageCookie}=${explicitLocale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [explicitLocale]);
  // Stable identity lets imperative map handlers read the current language
  // without rebuilding the globe or losing the camera position.
  const t = useCallback<Translator>((key, values) => translate(current.current, key, values), []);
  const setLocale = useCallback((next: Locale) => {
    current.current = next;
    updateLocale(next);
    document.documentElement.lang = next;
    document.cookie = `${languageCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [router]);
  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useTranslations() { const value = useContext(LanguageContext); if (!value) throw Error("LanguageProvider is required"); return value; }
