"use client";
import { TAG_LABELS, type EventTag } from "@/lib/event-tags";
import { useTranslations } from "./language-provider";

// Single-choice tag filter under the category chips. No "all" chip: tapping the
// active tag again clears it. Renders nothing without chips (see selectVisibleTags).
export function TagChips({ tags, value, disabled = false, onChange }: { tags: EventTag[]; value: EventTag | ""; disabled?: boolean; onChange: (value: EventTag | "") => void }) {
  const { t } = useTranslations();
  if (!tags.length) return null;
  return <div className="tag-chips" role="group" aria-label={t("세부 태그 필터")}>
    {tags.map((tag) => <button key={tag} type="button" aria-pressed={value === tag} disabled={disabled}
      onClick={() => onChange(value === tag ? "" : tag)}>{t(TAG_LABELS[tag])}</button>)}
  </div>;
}
