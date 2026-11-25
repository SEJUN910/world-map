// Search terms → PostgREST filters, shared by the list and the map markers so
// both always return the same events. See .omc/plans/search-and-actions.md.
//
// Each word must match (AND across words, so "서울 뮤지컬" means both); a word
// matches title, region, venue or address, a tag or category whose label is
// exactly that word (in any UI language), or the description when the word is
// long enough not to hit inside unrelated words (French "partir" for "art").
import { TAG_LABELS, type EventTag } from "./event-tags";
import { CATEGORY_LABELS, type EventCategory } from "./event-categories";
import { messages } from "./i18n/messages";

const MAX_WORDS = 4;
// Characters that would break PostgREST's filter grammar, act as LIKE wildcards,
// or that Postgres rejects (NUL and other control characters).
const UNSAFE = /[\\%_,()."'{}*:\u0000-\u001f\u007f]/g;
const normal = (value: string) => value.normalize("NFKC").toLowerCase().trim();
const compact = (value: string) => normal(value).replace(/[\s-]+/g, "");

// Every UI-language label of a key ("뮤지컬", "musical", "音樂劇") plus the key itself.
const translations = new Map(messages.map(([ko, en, zh]) => [ko, [ko, en, zh]]));
type Target = { tag?: EventTag; category?: EventCategory };
const index = new Map<string, Target>();
const phrases: string[] = [];
function add(label: string, target: Target) {
  for (const form of [normal(label), compact(label)]) if (form && !index.has(form)) index.set(form, target);
  if (/\s/.test(normal(label))) phrases.push(normal(label));
}
for (const [tag, label] of Object.entries(TAG_LABELS) as [EventTag, string][]) {
  add(tag.replace(/-/g, " "), { tag });
  for (const form of translations.get(label) || [label]) add(form, { tag });
}
// "기타" (other) is left out: it would list every uncategorized event for the guitar.
for (const [category, label] of Object.entries(CATEGORY_LABELS) as [EventCategory, string][]) {
  if (category === "other") continue;
  add(category, { category });
  for (const form of translations.get(label) || [label]) add(form, { category });
}
for (const [alias, target] of [["전시회", { category: "exhibition" }], ["페스티벌", { category: "festival" }], ["키즈", { tag: "kids" }], ["아동", { tag: "kids" }], ["사진전", { tag: "photo" }]] as [string, Target][]) add(alias, target);
phrases.sort((a, b) => b.length - a.length);

// "Free" in any UI language also finds the French listings' "gratuit".
const FREE = new Set(["무료", "free", "免費", "gratuit"]);
const FREE_TEXT = ["무료", "gratuit", "free"];

/** Up to four words; multi-word labels ("street art", "도보 투어") stay one word. */
export function searchWords(query: string): string[] {
  let rest = ` ${normal(query.slice(0, 100)).replace(UNSAFE, " ").replace(/\s+/g, " ")} `;
  const words: string[] = [];
  // Whole words only: "downstreet artwork" is not "street art".
  for (const phrase of phrases) {
    if (!rest.includes(` ${phrase} `)) continue;
    words.push(phrase);
    rest = rest.split(` ${phrase} `).join("  ");
  }
  for (const word of rest.split(/\s+/)) if (word && !words.includes(word)) words.push(word);
  return words.slice(0, MAX_WORDS);
}

/** Descriptions are long (French ~1,500 chars): only CJK words of 2+ or Latin words of 4+ are looked for there. */
export function searchesDescription(word: string): boolean {
  return /[^\u0000-ɏ]/.test(word) ? [...word].length >= 2 : word.length >= 4;
}

/** One PostgREST `or` filter per word. */
export function searchClauses(query: string): string[] {
  return searchWords(query).map((word) => {
    const clauses = ["title", "region", "venue", "address"].map((column) => `${column}.ilike.%${word}%`);
    const texts = FREE.has(word) ? FREE_TEXT : searchesDescription(word) ? [word] : [];
    for (const text of texts) clauses.push(`description.ilike.%${text}%`);
    const target = index.get(word) ?? index.get(compact(word));
    if (target?.tag) clauses.push(`tags.cs.{${target.tag}}`);
    if (target?.category) clauses.push(`category.eq.${target.category}`);
    return clauses.join(",");
  });
}

export function applySearch<T extends { or(filters: string): T }>(request: T, query: string): T {
  for (const clause of searchClauses(query)) request = request.or(clause);
  return request;
}
