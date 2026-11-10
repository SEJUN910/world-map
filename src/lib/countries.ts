export const countries = {
  kr: { path: "/korea", name: "대한민국", english: "SOUTH KOREA", timezone: "Asia/Seoul", center: [127.8, 36.2] as [number, number], zoom: 5.5, bounds: [124, 33, 132, 39] },
  tw: { path: "/taiwan", name: "대만", english: "TAIWAN", timezone: "Asia/Taipei", center: [120.9, 23.7] as [number, number], zoom: 6.4, bounds: [118, 21.8, 123, 26.5] },
} as const;
export type CountryCode = keyof typeof countries;
export function isCountryCode(value: unknown): value is CountryCode { return value === "kr" || value === "tw"; }
export function pointInCountry(country: CountryCode, point: { latitude: number; longitude: number } | null | undefined) {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  const [west, south, east, north] = countries[country].bounds;
  return point.longitude >= west && point.longitude <= east && point.latitude >= south && point.latitude <= north;
}
