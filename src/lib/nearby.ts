// "Near me": distances, the widening radius, map zoom and the accuracy circle.
// The visitor's position stays in the browser: never stored, never put in a URL,
// never sent to a server or to analytics. See .omc/plans/nearby.md.
import { COUNTRY_CODES, pointInCountry, type CountryCode } from "./countries";

export type Position = { latitude: number; longitude: number; accuracy: number };
type Point = { id: string; latitude: number; longitude: number };

const EARTH = 6_371_000;
const rad = (degrees: number) => degrees * Math.PI / 180;

/** Great-circle distance in meters. */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const NEARBY_RADII_KM = [10, 30, 50] as const;

/** Events within the first radius (10, then 30, then 50 km) that has any, nearest first. */
export function nearbyEvents(points: Point[], origin: { latitude: number; longitude: number }): { radiusKm: number; items: { id: string; meters: number }[] } {
  const measured = points
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .map((point) => ({ id: point.id, meters: distanceMeters(origin, point) }))
    .sort((a, b) => a.meters - b.meters || (a.id < b.id ? -1 : 1));
  for (const radiusKm of NEARBY_RADII_KM) {
    const items = measured.filter((item) => item.meters <= radiusKm * 1000);
    if (items.length) return { radiusKm, items };
  }
  return { radiusKm: NEARBY_RADII_KM[NEARBY_RADII_KM.length - 1], items: [] };
}

/** Close for a precise fix, wider when the browser only knows roughly. */
export function zoomForAccuracy(accuracy: number): number {
  return accuracy > 10_000 ? 10 : accuracy > 1_000 ? 11 : 12.5;
}
export const APPROXIMATE_METERS = 1_000;
/** Beyond this the distance labels would be misleading. */
export const NO_DISTANCE_METERS = 10_000;

/** "850m" / "2.4km" / "12km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
  return meters < 10_000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters / 1000)}km`;
}

/**
 * The supported country the position is in, if any (countries' boxes do not overlap).
 * Known limit: these are bounding boxes, so e.g. Fukuoka counts as Korea and
 * Barcelona as France; such visitors get an empty-nearby or a "go to France" notice.
 */
export function countryAt(position: { latitude: number; longitude: number }): CountryCode | null {
  return COUNTRY_CODES.find((code) => pointInCountry(code, position)) ?? null;
}

/** A 48-sided polygon approximating the accuracy circle; none when tiny or huge. */
export function accuracyCircle(position: Position, steps = 48): GeoJSON.Feature<GeoJSON.Polygon> | null {
  if (!(position.accuracy >= 30 && position.accuracy <= 20_000)) return null;
  const dLat = position.accuracy / EARTH * 180 / Math.PI;
  const dLng = dLat / Math.max(0.01, Math.cos(rad(position.latitude)));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i % steps) / steps * 2 * Math.PI;
    ring.push([position.longitude + dLng * Math.cos(angle), position.latitude + dLat * Math.sin(angle)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

// One-time hand-off across a client navigation (to another country's page, or
// from a region page to the whole country): module memory only, 10 seconds.
let pending: { position: Position; expires: number } | null = null;
let forget: ReturnType<typeof setTimeout> | undefined;
export function handOffPosition(position: Position, now = Date.now()) {
  pending = { position, expires: now + 10_000 };
  // Not kept in memory past its use either.
  clearTimeout(forget);
  forget = setTimeout(() => { pending = null; }, 10_000);
  (forget as { unref?: () => void }).unref?.();
}
export function takeHandedOffPosition(now = Date.now()): Position | null {
  const value = pending && pending.expires >= now ? pending.position : null;
  pending = null;
  return value;
}
