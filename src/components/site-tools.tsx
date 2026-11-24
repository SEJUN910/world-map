"use client";
import { AccountControl } from "./account-control";
import { LanguageSelect } from "./language-select";
import { useTranslations } from "./language-provider";
import { SavedEventsLink } from "./saved-events";

export function SiteTools({ atlas = false }: { atlas?: boolean }) {
  const { t } = useTranslations();
  return <div className={`site-tools${atlas ? " site-tools--atlas" : ""}`} role="group" aria-label={t("화면 도구")}>
    <SavedEventsLink />
    <AccountControl compact />
    <LanguageSelect />
  </div>;
}
