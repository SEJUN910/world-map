// Themes: ready-made filters such as "with kids" (?theme=kids). A theme matches
// an event that carries any of its tags or has any of its words in the title.
// Korean listings only carry genre tags (concert, theater, …), so the words do
// most of the work there; the Paris listings are tagged in more detail.
//
// To add or tune a theme, edit this table (and add the label to
// src/lib/i18n/messages.ts). Words must be plain text: no , . ( ) * % _ : " ' { }.
import type { EventTag } from "./event-tags";

export const EVENT_THEMES = {
  kids: {
    label: "아이랑",
    tags: ["kids", "circus"],
    words: ["어린이", "가족", "키즈", "아동", "유아", "인형극", "동화", "enfant", "famille", "jeune public", "親子", "兒童"],
  },
  date: {
    label: "데이트",
    tags: ["musical", "night", "photo", "painting"],
    words: ["재즈", "야경", "불빛", "빛축제", "크리스마스", "로맨틱", "jazz", "nocturne", "noël"],
  },
  tradition: {
    label: "전통·역사",
    tags: ["gugak", "history"],
    words: ["국악", "전통", "판소리", "한복", "궁중", "patrimoine", "傳統"],
  },
} as const satisfies Record<string, { label: string; tags: readonly EventTag[]; words: readonly string[] }>;
export type EventTheme = keyof typeof EVENT_THEMES;
export const THEME_KEYS = Object.keys(EVENT_THEMES) as EventTheme[];

export function isEventTheme(value: unknown): value is EventTheme {
  return typeof value === "string" && Object.hasOwn(EVENT_THEMES, value);
}

// Same characters src/lib/event-search.ts keeps out of PostgREST filters.
const UNSAFE = /[\\%_,()."'{}*:\u0000-\u001f\u007f]/;

/** One PostgREST `or` value: any tag of the theme, or any of its words in the title. */
export function themeClause(theme: EventTheme): string {
  const { tags, words } = EVENT_THEMES[theme];
  return [
    ...tags.map((tag) => `tags.cs.{${tag}}`),
    ...words.filter((word) => word && !UNSAFE.test(word)).map((word) => `title.ilike.*${word}*`),
  ].join(",");
}
