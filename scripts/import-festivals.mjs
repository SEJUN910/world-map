// Import the official standard-data download, without exposing management keys to the app.
// Dry-run by default. The portal does not provide stable row IDs, so identities are
// conservative fingerprints of normalized title, start date and venue.
import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const sourceName = "national_cultural_festivals";
const sourceUrl = "https://www.data.go.kr/data/15013104/standard.do";
const base = "https://www.data.go.kr";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const apply = process.argv.includes("--apply");
if (apply) throw new Error("Legacy standard-data writes are disabled. Use npm run import:tourapi instead.");
const clean = (v) => typeof v === "string" ? v.trim() : "";
const fingerprintPart = (v) => clean(v).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const slug = (v) => clean(v).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "event";
const validDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
};
function website(value) {
  const v = clean(value);
  if (!v) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.hostname.includes(".") && url.href.length <= 1000 ? url.href : "";
  } catch { return ""; }
}
function normalize(raw, syncedAt) {
  const title = clean(raw.FSTVL_NM);
  const venue = clean(raw.OPAR);
  const start = clean(raw.FSTVL_START_DATE);
  const end = clean(raw.FSTVL_END_DATE);
  const provider = clean(raw.INSTT_NM);
  const address = clean(raw.RDNMADR) || clean(raw.LNMADR);
  const lat = Number(clean(raw.LATITUDE));
  const lng = Number(clean(raw.LONGITUDE));
  if (!title || title.length > 100 || !venue || venue.length > 120 || !provider || provider.length > 100 || address.length > 200 || !validDate(start) || !validDate(end) || end < start || end < today || !clean(raw.LATITUDE) || !clean(raw.LONGITUDE) || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;
  // Group the Korea explorer by province/metropolitan city; the full city and
  // street remain available in address and the originating provider fields.
  const region = (address || provider).split(/\s+/)[0];
  if (!region || region.length > 60 || /공사|재단|협회/.test(region)) return null;
  const identity = [fingerprintPart(title), start, fingerprintPart(venue)].join("|");
  if (!fingerprintPart(title) || !fingerprintPart(venue)) return null;
  const reference = clean(raw.REFERENCE_DATE);
  return {
    source_name: sourceName,
    source_id: createHash("sha256").update(identity).digest("hex"),
    source_url: sourceUrl,
    source_provider: provider,
    source_reference_date: validDate(reference) ? reference : null,
    source_synced_at: syncedAt,
    title,
    slug: slug(title),
    description: clean(raw.FSTVL_CO).slice(0, 3000),
    region,
    region_code: slug(region),
    venue,
    address,
    latitude: lat,
    longitude: lng,
    start_date: start,
    end_date: end,
    official_url: website(raw.HOMEPAGE_URL),
  };
}
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Official data request failed: HTTP ${response.status}`);
  return response.json();
}
async function download() {
  const header = await json(`${base}/download/columList.json?pk=15013104&ext=JSON`);
  const { colNmList, svcTableNm } = header.tableVO || {};
  if (!Array.isArray(colNmList) || svcTableNm !== "tn_pubr_public_cltur_fstvl_svc" || !Number.isInteger(header.totalCount) || header.totalCount < 1 || header.totalCount > 50000) throw new Error("Unexpected official dataset metadata; refusing to import");
  const records = [];
  for (let page = 1; records.length < header.totalCount; page++) {
    const url = new URL(`${base}/download/standard.json`);
    for (const col of colNmList) url.searchParams.append("colNmList", col);
    for (const [key, value] of Object.entries({ publicDataPk: "15013104", totalCount: header.totalCount, svcTableNm, perPage: 10000, page })) url.searchParams.set(key, String(value));
    const batch = await json(url);
    if (!Array.isArray(batch) || !batch.length || batch.length > 10000) throw new Error("Incomplete official data download; refusing to import");
    records.push(...batch);
  }
  if (records.length !== header.totalCount) throw new Error("Official data changed during download; retry before importing");
  return records;
}
const records = await download();
const now = new Date().toISOString();
const unique = new Map();
let eligible = 0;
for (const raw of records) {
  if (validDate(clean(raw.FSTVL_END_DATE)) && clean(raw.FSTVL_END_DATE) >= today) eligible++;
  const row = normalize(raw, now);
  if (!row) continue;
  const previous = unique.get(row.source_id);
  if (!previous || (row.source_reference_date || "") > (previous.source_reference_date || "")) unique.set(row.source_id, row);
}
const rows = [...unique.values()];
console.log(`Official rows: ${records.length}; ongoing/upcoming: ${eligible}; usable unique: ${rows.length}; skipped/duplicates: ${eligible - rows.length}. Korea date: ${today}`);
if (!rows.length) throw new Error("No valid ongoing/upcoming events; refusing to write");
if (!apply) {
  console.log("Dry run only; use --apply with an explicitly scoped service key and project ref.");
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_IMPORT_SERVICE_KEY;
  const project = process.env.SUPABASE_IMPORT_PROJECT_REF;
  if (!url || !key || !project || new URL(url).hostname !== `${project}.supabase.co`) throw new Error("Provide SUPABASE_IMPORT_SERVICE_KEY and matching SUPABASE_IMPORT_PROJECT_REF");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("events").select("id,source_id,publication_status").eq("source_name", sourceName).range(offset, offset + 999);
    if (error) throw error;
    for (const row of data) existing.set(row.source_id, row);
    if (data.length < 1000) break;
  }
  const inserts = rows.filter(row => !existing.has(row.source_id)).map(row => ({ ...row, author_id: null, publication_status: "published" }));
  // Never restore hidden/deleted events or overwrite a user's event.
  const updates = rows.filter(row => existing.has(row.source_id));
  if (inserts.length) {
    const { error } = await client.from("events").insert(inserts);
    if (error) throw error;
  }
  for (const row of updates) {
    const { source_name, source_id, ...fields } = row;
    const { error } = await client.from("events").update(fields).eq("id", existing.get(source_id).id).eq("source_name", sourceName).eq("source_id", source_id);
    if (error) throw error;
  }
  console.log(`Imported ${inserts.length} new events and refreshed ${updates.length} existing events. Hidden/deleted states are preserved.`);
}
