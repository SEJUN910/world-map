"use client";
import { CATEGORY_LABELS, EVENT_CATEGORIES, type EventCategory } from "@/lib/event-categories";
import { useTranslations } from "./language-provider";

// Single-choice category filter: tapping the active chip again (or "전체") clears it.
export function CategoryChips({ value, disabled = false, onChange }: { value: EventCategory | ""; disabled?: boolean; onChange: (value: EventCategory | "") => void }) {
  const { t } = useTranslations();
  return <div className="category-chips" role="group" aria-label={t("분야 필터")}>
    <button type="button" aria-pressed={!value} disabled={disabled} onClick={() => { if (value) onChange(""); }}>{t("전체")}</button>
    {EVENT_CATEGORIES.map((category) => <button key={category} type="button" aria-pressed={value === category} disabled={disabled}
      onClick={() => onChange(value === category ? "" : category)}>{t(CATEGORY_LABELS[category])}</button>)}
  </div>;
}
