"use client";
import { AccountControl } from "./account-control";
import { LanguageSelect } from "./language-select";
import { useTranslations } from "./language-provider";

export function SiteTools({ atlas = false, catalogOpen, onToggleCatalog }: {
  atlas?: boolean;
  catalogOpen?: boolean;
  onToggleCatalog?: () => void;
}) {
  const { t } = useTranslations();
  const catalogLabel = t(catalogOpen ? "포스터 접기" : "포스터 보기");
  return <div className={`site-tools${atlas ? " site-tools--atlas" : ""}`} role="group" aria-label={t("화면 도구")}>
    <AccountControl compact />
    <LanguageSelect />
    {onToggleCatalog && <>
      <span className="site-tools__divider" aria-hidden="true" />
      <button className="site-tools__catalog" type="button" aria-label={catalogLabel} title={catalogLabel}
        aria-controls="atlas-catalog" aria-expanded={catalogOpen} onClick={onToggleCatalog}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M15 4v16" stroke="currentColor" strokeWidth="1.4" />
          <path d={catalogOpen ? "m8 9 3 3-3 3" : "m11 9-3 3 3 3"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>}
  </div>;
}
