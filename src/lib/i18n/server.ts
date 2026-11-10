import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, languageCookie, translate, type Translator } from "./index";
export async function getLocale() { const explicit = (await headers()).get("x-festiva-locale"); if (isLocale(explicit)) return explicit; const value = (await cookies()).get(languageCookie)?.value; return isLocale(value) ? value : "ko"; }
export async function getTranslations(): Promise<Translator> { const locale = await getLocale(); return (key, values) => translate(locale, key, values); }
