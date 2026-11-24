// Countries a visitor can ask us to add: ISO 3166-1 alpha-2 codes minus the
// ones already supported. Names come from Intl.DisplayNames in the UI language.
import { COUNTRY_CODES, countries } from "./countries";

const ISO_3166_1 = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const SUPPORTED = new Set<string>(COUNTRY_CODES.map((code) => countries[code].iso));

/** ISO codes that can be requested (not yet supported), in code order. */
export const REQUESTABLE_COUNTRIES: readonly string[] = ISO_3166_1.filter((code) => !SUPPORTED.has(code));
export function isRequestableCountry(value: unknown): value is string {
  return typeof value === "string" && REQUESTABLE_COUNTRIES.includes(value);
}

const displayNames = new Map<string, Intl.DisplayNames | null>();
/** Country name in the given language, falling back to the ISO code. */
export function countryName(code: string, locale: string): string {
  if (!displayNames.has(locale)) {
    try { displayNames.set(locale, new Intl.DisplayNames([locale], { type: "region" })); } catch { displayNames.set(locale, null); }
  }
  try { return displayNames.get(locale)?.of(code) || code; } catch { return code; }
}

// Names in every UI language, built once per display language: the list is
// shown in that language but any of them (or the ISO code) matches a search.
const SEARCH_LANGUAGES = ["ko", "en", "zh-TW"];
const catalogs = new Map<string, { code: string; name: string; terms: string[] }[]>();
function catalog(locale: string) {
  let entries = catalogs.get(locale);
  if (!entries) {
    entries = REQUESTABLE_COUNTRIES
      .map((code) => ({ code, name: countryName(code, locale), terms: [code.toLowerCase(), ...SEARCH_LANGUAGES.map((language) => countryName(code, language).toLowerCase())] }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
    catalogs.set(locale, entries);
  }
  return entries;
}

/** Requestable countries named in the UI language, filtered by a name (any UI language) or exact ISO code, sorted by name. */
export function searchRequestableCountries(query: string, locale: string): { code: string; name: string }[] {
  const needle = query.trim().toLowerCase();
  return catalog(locale)
    .filter(({ terms }) => !needle || terms[0] === needle || terms.slice(1).some((term) => term.includes(needle)))
    .map(({ code, name }) => ({ code, name }));
}
