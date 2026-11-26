"use client";
import { AccountControl } from "./account-control";
import { LanguageSelect } from "./language-select";
import { useTranslations } from "./language-provider";
import { SavedEventsLink } from "./saved-events";

// The language select shows on the home screen only; everywhere else the tools are saved events and the account.
export function SiteTools({ atlas = false, language = false }: { atlas?: boolean; language?: boolean }) {
  const { t } = useTranslations();
  return <div className={`site-tools${atlas ? " site-tools--atlas" : ""}`} role="group" aria-label={t("화면 도구")}>
    <SavedEventsLink />
    <AccountControl compact />
    {language && <LanguageSelect />}
  </div>;
}
