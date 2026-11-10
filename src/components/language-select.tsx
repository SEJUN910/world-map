"use client";
import { isLocale } from "@/lib/i18n";
import { useTranslations } from "./language-provider";
export function LanguageSelect({ floating = false }: { floating?: boolean }) {
  const { locale, t, setLocale } = useTranslations();
  return <label className={`language-select${floating ? " language-select--floating" : ""}`}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" /><ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth="1.2" /><path d="M3 12h18" stroke="currentColor" strokeWidth="1.2" /></svg>
    <select aria-label={t("언어")} value={locale} onChange={(event) => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>
      <option value="ko" lang="ko">한국어</option><option value="en" lang="en">English</option><option value="zh-TW" lang="zh-TW">繁體中文</option>
    </select>
  </label>;
}
