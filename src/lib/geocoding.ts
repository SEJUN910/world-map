import { z } from "zod";
import { pointInCountry, type CountryCode } from "./countries";

export type AddressResult = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  region: string;
  venue: string;
  approximate: boolean;
};

const resultSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  formatted: z.string().min(1).max(1000),
  country_code: z.string(),
  place_id: z.string().optional(),
  name: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  district: z.string().optional(),
  result_type: z.string().optional(),
});

export function addressResults(payload: unknown, country: CountryCode = "kr"): AddressResult[] {
  if (!payload || typeof payload !== "object" || !("results" in payload) || !Array.isArray(payload.results)) return [];
  const seen = new Set<string>();
  return payload.results.slice(0, 10).flatMap((raw) => {
    const parsed = resultSchema.safeParse(raw);
    if (!parsed.success) return [];
    const result = parsed.data;
    if (result.country_code.toLowerCase() !== country || !pointInCountry(country, { latitude: result.lat, longitude: result.lon })) return [];
    const id = result.place_id || `${result.lat}:${result.lon}:${result.formatted}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      address: result.formatted.slice(0, 200),
      latitude: result.lat,
      longitude: result.lon,
      region: [...new Set([result.state, result.city || result.county, result.district].filter(Boolean))].join(" ").slice(0, 60),
      venue: (result.name || "").slice(0, 120),
      approximate: !["building", "amenity"].includes(result.result_type || ""),
    }];
  });
}
