"use client";
import type { DiscoveryFilters } from "@/lib/discovery-filters";
import { EVENT_THEMES, THEME_KEYS } from "@/lib/event-themes";
import { useTranslations } from "./language-provider";

// One-tap filters above the list: "this weekend" (the date filter) and the
// themes of src/lib/event-themes.ts. Tapping an active chip clears it.
export function QuickChips({ filters, disabled = false, onChange }: { filters: DiscoveryFilters; disabled?: boolean; onChange: (filters: DiscoveryFilters) => void }) {
  const { t } = useTranslations();
  const weekend = filters.when === "weekend";
  return <div className="tag-chips quick-chips" role="group" aria-label={t("빠른 필터")}>
    <button type="button" aria-pressed={weekend} disabled={disabled}
      onClick={() => onChange({ ...filters, when: weekend ? "all" : "weekend", from: "", to: "" })}>{t("이번 주말")}</button>
    {THEME_KEYS.map((theme) => <button key={theme} type="button" aria-pressed={filters.theme === theme} disabled={disabled}
      onClick={() => onChange({ ...filters, theme: filters.theme === theme ? "" : theme })}>{t(EVENT_THEMES[theme].label)}</button>)}
  </div>;
}
