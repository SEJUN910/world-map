import "server-only";
import { isCountryCode, type CountryCode } from "./countries";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { getSupabaseConfig } from "./supabase/config";
import type { Database } from "./supabase/database.types";
import type { FestivalEvent } from "./events";
import { isEventId, todayInCountry } from "./events";
import { cache } from "react";
import { normalizeRichText } from "./rich-text";

function activeSourceFilter() {
  return `source_name.is.null,and(country_code.eq.kr,end_date.gte.${todayInCountry("kr")}),and(country_code.eq.tw,end_date.gte.${todayInCountry("tw")})`;
}

export type CloudEvent = FestivalEvent & {
  authorId: string | null;
  publicationStatus: string;
  eventStatus: string;
  updatedAt: string;
  storagePath: string;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceProvider: string | null;
  sourceReferenceDate: string | null;
  sourceImageLicense: string | null;
};
export function publicClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
type RecordWithImage = Database["public"]["Tables"]["events"]["Row"] & {
  event_images: { storage_path: string }[] | { storage_path: string } | null;
};
async function mapEvents(
  client: SupabaseClient<Database>,
  rows: RecordWithImage[],
): Promise<CloudEvent[]> {
  const paths = rows.map((row) =>
    Array.isArray(row.event_images)
      ? row.event_images[0]?.storage_path
      : row.event_images?.storage_path,
  );
  const unique = [...new Set(paths.filter((path): path is string => !!path))];
  const urls = new Map<string, string>();
  if (unique.length) {
    const { data, error } = await client.storage
      .from("event-posters")
      .createSignedUrls(unique, 300);
    if (error) throw new Error("포스터를 불러오지 못했어요.");
    for (const image of data || [])
      if (image.path && image.signedUrl) urls.set(image.path, image.signedUrl);
  }
  return rows.map((row, index) => ({
    countryCode: isCountryCode(row.country_code) ? row.country_code : "kr",
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    descriptionContent: normalizeRichText(row.description_content),
    region: row.region,
    regionCode: row.region_code,
    venue: row.venue,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    startDate: row.start_date,
    endDate: row.end_date,
    officialUrl: row.official_url,
    poster: urls.get(paths[index] || "") || row.source_image_url || "",
    isSample: false,
    authorId: row.author_id,
    publicationStatus: row.publication_status,
    eventStatus: row.event_status,
    updatedAt: row.updated_at,
    storagePath: paths[index] || "",
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceProvider: row.source_provider,
    sourceReferenceDate: row.source_reference_date,
    sourceImageLicense: row.source_image_license,
  }));
}
export async function listEvents({
  country = "kr",
  region = "",
  query = "",
  page = 1,
  pageSize = 24,
}: { country?: CountryCode; region?: string; query?: string; page?: number; pageSize?: number } = {}) {
  const client = publicClient();
  let request = client
    .from("events")
    .select("*, event_images(storage_path)", { count: "exact" })
    .eq("country_code", country)
    .eq("publication_status", "published")
    .or(activeSourceFilter())
    .order("created_at", { ascending: false })
    .order("id");
  if (region) request = request.eq("region_code", region);
  // Escape PostgREST filter grammar and SQL LIKE wildcards. All values remain parameters.
  if (query.trim()) {
    const term = query
      .trim()
      .slice(0, 100)
      .replace(/[\\%_,()."']/g, " ");
    if (term.trim())
      request = request.or(
        `title.ilike.%${term}%,region.ilike.%${term}%,venue.ilike.%${term}%`,
      );
  }
  const { data, error, count } = await request.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );
  if (error)
    throw new Error("행사를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
  return { events: await mapEvents(client, data || []), total: count || 0 };
}

// The map must not inherit the poster grid's 24-item pagination. Fetch only
// public marker fields, in bounded batches, without generating image URLs.
export async function listEventMapPoints({ country, region = "", query = "" }: { country?: CountryCode; region?: string; query?: string } = {}) {
  const client = publicClient();
  const result: { id: string; slug: string; title: string; latitude: number; longitude: number; countryCode?: CountryCode }[] = [];
  const term = query.trim().slice(0, 100).replace(/[\\%_,()."']/g, " ");
  for (let offset = 0; offset < 5000; offset += 1000) {
    let request = client.from("events")
      .select("id,slug,title,latitude,longitude,country_code")
      .eq("publication_status", "published")
      .or(activeSourceFilter())
      .order("created_at", { ascending: false }).order("id");
    if (country) request = request.eq("country_code", country);
    if (region) request = request.eq("region_code", region);
    if (term.trim()) request = request.or(`title.ilike.%${term}%,region.ilike.%${term}%,venue.ilike.%${term}%`);
    const { data, error } = await request.range(offset, offset + 999);
    if (error) throw new Error("지도 위치를 불러오지 못했어요.");
    result.push(...(data || []).map((row) => ({ ...row, countryCode: isCountryCode(row.country_code) ? row.country_code : "kr" as const })));
    if (!data || data.length < 1000) break;
  }
  return result;
}
// Only resolve images for the small, visible set of map posters.
export async function getMapPosterEvents(ids: string[]): Promise<FestivalEvent[]> {
  const client = publicClient();
  const { data, error } = await client.from("events")
    .select("*, event_images(storage_path)")
    .in("id", ids)
    .eq("publication_status", "published")
    .or(activeSourceFilter());
  if (error) throw new Error("지도 포스터를 불러오지 못했어요.");
  const events = await mapEvents(client, data || []);
  return events.map(({ authorId: _author, publicationStatus: _publication, updatedAt: _updated, storagePath: _storage, ...event }) => event);
}

export const getPublicEvent = cache(async (id: string) => {
  if (!isEventId(id)) return null;
  const client = publicClient();
  const { data, error } = await client
    .from("events")
    .select("*, event_images(storage_path)")
    .eq("id", id)
    .eq("publication_status", "published")
    .maybeSingle();
  if (error) throw new Error("행사를 불러오지 못했어요.");
  return data ? (await mapEvents(client, [data]))[0] : null;
});
export async function getMyEvents() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { user: null, events: [] as CloudEvent[] };
  const { data, error } = await client
    .from("events")
    .select("*, event_images(storage_path)")
    .eq("author_id", user.id)
    .neq("publication_status", "deleted")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("내 행사를 불러오지 못했어요.");
  return { user, events: await mapEvents(client, data || []) };
}
export async function getMyEvent(id: string) {
  if (!isEventId(id)) return null;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from("events")
    .select("*, event_images(storage_path)")
    .eq("id", id)
    .eq("author_id", user.id)
    .neq("publication_status", "deleted")
    .maybeSingle();
  if (error) throw new Error("행사를 불러오지 못했어요.");
  return data ? (await mapEvents(client, [data]))[0] : null;
}

export async function getRegions(country: CountryCode = "kr") {
  const client = publicClient();
  const result: { code: string; name: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("event_regions")
      .select("code, name")
      .eq("country_code", country)
      .order("code")
      .range(offset, offset + 999);
    if (error) throw new Error("지역 목록을 불러오지 못했어요.");
    for (const row of data || [])
      if (row.code && row.name) result.push({ code: row.code, name: row.name });
    if (!data || data.length < 1000) return result;
  }
}
