import { messages } from "./messages";
export const locales = ["ko", "en", "zh-TW"] as const;
export type Locale = typeof locales[number];
export const languageCookie = "festiva-language";
export function isLocale(value: unknown): value is Locale { return locales.includes(value as Locale); }
const translations = new Map(messages.map(([ko, en, zh]) => [ko, { en, "zh-TW": zh }]));
const originals = new Map(messages.flatMap(([ko, en, zh]) => [[en, ko], [zh, ko]]));
export type Translator = (key: string, values?: Record<string, string | number>) => string;
export function translate(locale: Locale, key: string, values?: Record<string, string | number>) {
  // Stored UI notices may have been produced before the language was changed.
  const original = translations.has(key) ? key : originals.get(key) || key;
  const text = locale === "ko" ? original : translations.get(original)?.[locale] || key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(values?.[name] ?? match));
}
