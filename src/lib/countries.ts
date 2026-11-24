// The supported countries. Everything country-specific in the app (routes,
// analytics, validation, sitemap, SEO, globe) derives from this list; the
// database keeps matching check constraints (see supabase/migrations).
export const countries = {
  kr: { path: "/korea", name: "대한민국", english: "SOUTH KOREA", iso: "KR", timezone: "Asia/Seoul", center: [127.8, 36.2] as [number, number], zoom: 5.5, bounds: [124, 33, 132, 39], boundary: "/assets/korea.json" },
  tw: { path: "/taiwan", name: "대만", english: "TAIWAN", iso: "TW", timezone: "Asia/Taipei", center: [120.9, 23.7] as [number, number], zoom: 6.4, bounds: [118, 21.8, 123, 26.5], boundary: "/assets/taiwan.json" },
  // Events come from Paris, so the page opens on the city; bounds cover metropolitan France.
  fr: { path: "/france", name: "프랑스", english: "FRANCE", iso: "FR", timezone: "Europe/Paris", center: [2.3522, 48.8566] as [number, number], zoom: 11.5, bounds: [-5.5, 41.3, 9.8, 51.2], boundary: "/assets/france.json" },
} as const;
export type CountryCode = keyof typeof countries;
export const COUNTRY_CODES = Object.keys(countries) as [CountryCode, ...CountryCode[]];
export type CountryPath = (typeof countries)[CountryCode]["path"];
export const COUNTRY_PATHS = COUNTRY_CODES.map((code) => countries[code].path) as [CountryPath, ...CountryPath[]];
export function isCountryCode(value: unknown): value is CountryCode { return typeof value === "string" && Object.hasOwn(countries, value); }
export function countryByPath(path: string): CountryCode | null { return COUNTRY_CODES.find((code) => countries[code].path === path) ?? null; }
export function pointInCountry(country: CountryCode, point: { latitude: number; longitude: number } | null | undefined) {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  const [west, south, east, north] = countries[country].bounds;
  return point.longitude >= west && point.longitude <= east && point.latitude >= south && point.latitude <= north;
}
