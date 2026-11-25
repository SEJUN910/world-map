// Finer tags under a category (list/map filter). Keys come from the imports
// (scripts/import-paris.mjs TAG_KEYS, scripts/cultureinfo-lib.mjs REALM_TAGS);
// labels are translation keys. A tag without a label is never shown as a chip.
// See .omc/plans/tag-filter.md.
export const TAG_LABELS = {
  concert: "콘서트", theater: "연극", musical: "뮤지컬", dance: "무용", gugak: "국악",
  "contemporary-art": "현대미술", photo: "사진", painting: "회화", "street-art": "스트리트 아트", comics: "만화",
  literature: "문학", history: "역사", nature: "자연", walk: "도보 투어", kids: "어린이",
  food: "음식", fair: "박람회", "flea-market": "플리마켓", film: "영화", comedy: "코미디",
  circus: "서커스", night: "야간", sport: "스포츠", science: "과학",
} as const satisfies Record<string, string>;
export type EventTag = keyof typeof TAG_LABELS;

export function isEventTag(value: unknown): value is EventTag {
  return typeof value === "string" && Object.hasOwn(TAG_LABELS, value);
}

export const MIN_TAG_COUNT = 2;
export const MAX_TAG_CHIPS = 8;

/**
 * Chips for the current category: labelled tags on at least MIN_TAG_COUNT events
 * but not on all of them, most used first (ties by key), at most MAX_TAG_CHIPS.
 * Fewer than two chips shows none. An active tag outside that list is added in
 * front so it can always be cleared.
 */
export function selectVisibleTags(counts: Record<string, number>, total: number, active: EventTag | ""): EventTag[] {
  const ranked = Object.entries(counts)
    .filter((entry): entry is [EventTag, number] => isEventTag(entry[0]) && entry[1] >= MIN_TAG_COUNT && entry[1] < total)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, MAX_TAG_CHIPS)
    .map(([tag]) => tag);
  const visible = ranked.length >= 2 ? ranked : [];
  return active && !visible.includes(active) ? [active, ...visible] : visible;
}

/** Tag counts over a list of events (each event counts a tag once). */
export function countTags(rows: { tags?: string[] | null }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) for (const tag of new Set(row.tags || [])) counts[tag] = (counts[tag] || 0) + 1;
  return counts;
}
