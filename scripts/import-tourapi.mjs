// TourAPI import. The credential is loaded only server-side and never logged.
// Dry-run by default; replacement of the previous source is explicit and happens
// only after new public records and their images have been verified.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const sourceName = "tourapi";
const sourceUrl = "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578";
const apply = process.argv.includes("--apply");
const replaceStandard = process.argv.includes("--replace-standard");
if (replaceStandard && !apply) throw new Error("--replace-standard requires --apply");
let serviceKey = (process.env.TOUR_API_SERVICE_KEY || "").trim();
if (!serviceKey) throw new Error("TOUR_API_SERVICE_KEY is missing");
if (/%[0-9a-f]{2}/i.test(serviceKey)) {
  try { serviceKey = decodeURIComponent(serviceKey); }
  catch { throw new Error("TourAPI service key has invalid URL encoding"); }
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const start = `${Number(today.slice(0, 4)) - 1}${today.slice(5, 7)}${today.slice(8, 10)}`;
const syncedAt = new Date().toISOString();
const skipped = new Map();
function skip(reason) { skipped.set(reason, (skipped.get(reason) || 0) + 1); return null; }
const clean = (value) => typeof value === "string" ? value.trim() : "";
const slug = (value) => clean(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "event";
function date(value) {
  const v = clean(value).slice(0, 8);
  if (!/^\d{8}$/.test(v)) return null;
  const result = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  const parsed = new Date(`${result}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === result ? result : null;
}
function imageUrl(value) {
  try {
    const u = new URL(clean(value));
    if (u.protocol !== "https:" || u.hostname !== "tong.visitkorea.or.kr" || u.port || u.username || u.password || u.href.length > 2000) return "";
    return u.href;
  } catch { return ""; }
}
function plainText(value) {
  return clean(value).replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/[ \t]+/g, " ").trim();
}
function website(value) {
  const raw = clean(value);
  const candidate = raw.match(/href\s*=\s*["'](https?:\/\/[^"']+)["']/i)?.[1] || raw;
  try {
    const u = new URL(candidate.replace(/&amp;/g, "&"));
    return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password && u.hostname.includes(".") && u.href.length <= 1000 ? u.href : "";
  } catch { return ""; }
}
async function request(endpoint, params) {
  const url = new URL(`https://apis.data.go.kr/B551011/KorService2/${endpoint}`);
  const common = { serviceKey, MobileOS: "ETC", MobileApp: "FESTIVA", _type: "json", ...params };
  for (const [key, value] of Object.entries(common)) url.searchParams.set(key, String(value));
  let response, body;
  try { response = await fetch(url, { signal: AbortSignal.timeout(30000) }); body = await response.json(); }
  catch { throw new Error(`TourAPI ${endpoint} request failed`); }
  const code = body.response?.header?.resultCode || body.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
  if (!response.ok || code !== "0000") throw new Error(`TourAPI ${endpoint} failed (HTTP ${response.status}, code ${String(code || "unknown").slice(0, 20)})`);
  const result = body.response.body;
  const raw = result?.items?.item;
  return { total: Number(result?.totalCount), items: !raw ? [] : Array.isArray(raw) ? raw : [raw] };
}
async function fetchAll() {
  const all = [];
  let total = null;
  for (let pageNo = 1; total === null || all.length < total; pageNo++) {
    const page = await request("searchFestival2", { numOfRows: 1000, pageNo, eventStartDate: start, arrange: "A" });
    if (!Number.isSafeInteger(page.total) || page.total < 0 || page.total > 20000 || (total !== null && total !== page.total)) throw new Error("Unexpected or changing TourAPI result count; refusing to import");
    total = page.total;
    if (all.length < total && !page.items.length) throw new Error("Incomplete TourAPI results; refusing to import");
    all.push(...page.items);
  }
  if (all.length !== total) throw new Error("Incomplete TourAPI results; refusing to import");
  return all;
}
async function imageAvailable(url) {
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(15000) });
    const type = response.headers.get("content-type") || "";
    if (response.body) await response.body.cancel();
    return response.ok && /^image\/(jpeg|jpg|png|webp|gif)(?:;|$)/i.test(type);
  } catch { return false; }
}
async function buildEvent(item) {
  const id = clean(item.contentid);
  if (!/^\d{1,20}$/.test(id)) return skip("invalid source ID");
  const [intro, detail] = await Promise.all([
    request("detailIntro2", { contentId: id, contentTypeId: 15, numOfRows: 1, pageNo: 1 }),
    request("detailCommon2", { contentId: id, numOfRows: 1, pageNo: 1 }),
  ]);
  const extra = intro.items[0] || {};
  const common = detail.items[0] || {};
  const title = clean(common.title) || clean(item.title);
  const address = [clean(common.addr1) || clean(item.addr1), clean(common.addr2) || clean(item.addr2)].filter(Boolean).join(" ");
  const venue = plainText(extra.eventplace) || clean(common.addr2) || clean(item.addr2) || address;
  const startDate = date(extra.eventstartdate) || date(item.eventstartdate);
  const endDate = date(extra.eventenddate) || date(item.eventenddate);
  const latString = clean(common.mapy) || clean(item.mapy);
  const lngString = clean(common.mapx) || clean(item.mapx);
  const latitude = Number(latString), longitude = Number(lngString);
  const image = imageUrl(common.firstimage) || imageUrl(item.firstimage);
  const license = clean(common.cpyrhtDivCd) || clean(item.cpyrhtDivCd);
  const region = address.split(/\s+/)[0];
  if (!title || title.length > 100 || !venue || venue.length > 120 || !address || address.length > 200 || !region || region.length > 60) return skip("missing or invalid location/title");
  if (!startDate || !endDate || endDate < startDate || endDate < today) return skip("missing, invalid or changed dates");
  if (!latString || !lngString || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) return skip("missing or invalid coordinates");
  if (!image || !["Type1", "Type3"].includes(license)) return skip("missing image or unsupported license");
  if (!await imageAvailable(image)) return skip("image unavailable");
  return {
    source_name: sourceName, source_id: id, source_url: sourceUrl,
    source_provider: "한국관광공사", source_reference_date: date(clean(common.modifiedtime) || clean(item.modifiedtime)),
    source_synced_at: syncedAt, source_image_url: image, source_image_license: license,
    title, slug: slug(title), description: plainText(common.overview).slice(0, 3000),
    region, region_code: slug(region), venue, address, latitude, longitude,
    start_date: startDate, end_date: endDate, official_url: website(extra.eventhomepage) || website(common.homepage),
  };
}
async function main() {
  const all = await fetchAll();
  const candidates = [...new Map(all.filter(item => {
    const end = date(item.eventenddate);
    return end && end >= today;
  }).map(item => [clean(item.contentid), item])).values()];
  console.log(`TourAPI rows: ${all.length}; ongoing/upcoming candidates: ${candidates.length}; Korea date: ${today}`);
  if (!candidates.length) throw new Error("No ongoing/upcoming TourAPI events; refusing to write or replace");
  const rows = [];
  let cursor = 0, completed = 0;
  await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, async () => {
    while (cursor < candidates.length) {
      const item = candidates[cursor++];
      const row = await buildEvent(item);
      if (row) rows.push(row);
      completed++;
      if (completed % 25 === 0 || completed === candidates.length) console.log(`Checked ${completed}/${candidates.length} events and original images`);
    }
  }));
  console.log(`Usable with verified original images: ${rows.length}; missing/unusable image or required fields: ${candidates.length - rows.length}`);
  if (skipped.size) console.log("Excluded:", Object.fromEntries(skipped));
  if (!rows.length) throw new Error("No valid image-bearing TourAPI events; refusing to write or replace");
  if (!apply) { console.log("Dry run only; add --apply to write."); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_IMPORT_SERVICE_KEY;
  const ref = process.env.SUPABASE_IMPORT_PROJECT_REF;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !service || !ref || !publicKey || new URL(url).hostname !== `${ref}.supabase.co`) throw new Error("Provide SUPABASE_IMPORT_SERVICE_KEY and matching SUPABASE_IMPORT_PROJECT_REF");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient(url, service, options);
  const publicClient = createClient(url, publicKey, options);
  const existing = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("events").select("id,source_id,publication_status").eq("source_name", sourceName).range(offset, offset + 999);
    if (error) throw new Error(`Could not read existing imports (${error.code})`);
    for (const row of data) existing.set(row.source_id, row);
    if (data.length < 1000) break;
  }
  const inserts = rows.filter(row => !existing.has(row.source_id)).map(row => ({ ...row, author_id: null, publication_status: "published" }));
  const updates = rows.filter(row => existing.has(row.source_id));
  if (inserts.length) {
    const { error } = await client.from("events").insert(inserts);
    if (error) throw new Error(`Could not insert TourAPI records (${error.code})`);
  }
  for (const row of updates) {
    const { source_name, source_id, ...fields } = row;
    const { error } = await client.from("events").update(fields).eq("id", existing.get(source_id).id).eq("source_name", sourceName).eq("source_id", source_id);
    if (error) throw new Error(`Could not refresh TourAPI record (${error.code})`);
  }
  // Public RLS must expose each newly imported or already-public record with its image.
  const expected = rows.filter(row => !existing.has(row.source_id) || existing.get(row.source_id).publication_status === "published");
  for (let offset = 0; offset < expected.length; offset += 100) {
    const ids = expected.slice(offset, offset + 100).map(row => row.source_id);
    const { data, error } = await publicClient.from("events").select("source_id,source_image_url").eq("source_name", sourceName).eq("publication_status", "published").in("source_id", ids);
    if (error || data.length !== ids.length || data.some(row => !imageUrl(row.source_image_url))) throw new Error("Public verification failed; previous data has not been replaced");
  }
  if (!expected.length) throw new Error("No public replacement events; previous data has not been replaced");
  console.log(`TourAPI: inserted ${inserts.length}, refreshed ${updates.length}; verified ${expected.length} public image-bearing events.`);
  if (replaceStandard) {
    // Scoped soft deletion preserves any reports; user-created events are untouched.
    const { data, error } = await client.from("events").update({ publication_status: "deleted" }).eq("source_name", "national_cultural_festivals").is("author_id", null).neq("publication_status", "deleted").select("id");
    if (error) throw new Error(`Could not replace previous standard-data records (${error.code})`);
    console.log(`Removed ${data.length} previous standard-data events from public listings (soft-deleted).`);
  }
}
main().catch(error => { console.error(`Import stopped: ${error.message}`); process.exitCode = 1; });
