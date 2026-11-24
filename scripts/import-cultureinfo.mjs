// Imports Korean festivals, exhibitions and shorter performance runs from the
// Korea Culture Information Service "한눈에보는문화정보" (data.go.kr 15138937,
// no usage restriction). Dry run by default.
//   --apply       write through the service key (GitHub Actions weekly sync)
//   --sql FILE    write a reviewed upsert for the database Management API
// Festivals already imported from TourAPI are skipped (TourAPI wins).
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { classify, normalizeRegion, sameEvent, selectRule, xmlText } from "./cultureinfo-lib.mjs";

const apply = process.argv.includes("--apply");
const sqlIndex = process.argv.indexOf("--sql");
const sqlFile = sqlIndex >= 0 ? process.argv[sqlIndex + 1] : null;
if (sqlIndex >= 0 && !sqlFile) throw new Error("--sql requires an output filename");
if (apply && sqlFile) throw new Error("Use either --apply or --sql");

// The data.go.kr key may be stored decoded or already URL-encoded; it must be
// encoded exactly once (twice makes it "unregistered", never makes "+" a space).
const rawKey = (process.env.TOUR_API_SERVICE_KEY || "").trim();
if (!rawKey) throw new Error("Provide TOUR_API_SERVICE_KEY");
const serviceKey = encodeURIComponent(/%[0-9a-f]{2}/i.test(rawKey) ? decodeURIComponent(rawKey) : rawKey);
const api = "https://apis.data.go.kr/B553457/cultureinfo";
const sourceName = "kcisa_culture";
const sourceUrl = "https://www.data.go.kr/data/15138937/openapi.do";
const syncedAt = new Date().toISOString();
const seoulDate = (time = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
const today = seoulDate();
const until = seoulDate(Date.now() + 180 * 86_400_000);
const MIN_EVENTS = 30;
const MIN_KEPT_SHARE = 0.7;
const SPACING_MS = 250;
let lastCall = 0;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const slug = (value) => clean(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "event";
const cut = (value, max) => value.length <= max ? value : `${value.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
const isoDate = (value) => { const v = clean(value); return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null; };
/** The element's content as plain text (see xmlText). */
const field = (xml, tag) => xmlText((xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1] || "");
const items = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
const uuidFor = (id) => {
  const hash = createHash("sha256").update(`${sourceName}:${id}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const https = (url) => clean(url).replace(/^http:\/\/www\.culture\.go\.kr\//, "https://www.culture.go.kr/");
const website = (value) => { const url = clean(value); return /^https?:\/\/\S+$/i.test(url) && url.length <= 1000 ? url : ""; };

async function call(operation, params) {
  const query = new URLSearchParams(params).toString();
  // The gateway allows only a few calls per second: calls are spaced out and a
  // per-second rejection is retried after a pause.
  for (let attempt = 0; ; attempt++) {
    const wait = SPACING_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCall = Date.now();
    const response = await fetch(`${api}/${operation}?serviceKey=${serviceKey}&${query}`, { signal: AbortSignal.timeout(30000) });
    const body = await response.text();
    if (/PER_SECOND_EXCEEDS/.test(body) && attempt < 5) { await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); continue; }
    const code = (body.match(/<resultCode>(\w+)<\/resultCode>/) || body.match(/<returnReasonCode>(\w+)<\/returnReasonCode>/) || [])[1];
    if (!response.ok || code !== "00") throw new Error(`Culture info ${operation} failed (${response.status} ${code || "?"})`);
    return body;
  }
}
async function imageAvailable(url) {
  try {
    const response = await fetch(url, { redirect: "manual", headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(15000) });
    const type = response.headers.get("content-type") || "";
    await response.body?.cancel();
    return (response.status === 200 || response.status === 206) && /^image\/(jpeg|jpg|png|webp|gif)(?:;|$)/i.test(type);
  } catch { return false; }
}

const skipped = new Map();
const skip = (reason) => { skipped.set(reason, (skipped.get(reason) || 0) + 1); return null; };

async function fetchListing() {
  const all = [];
  let total = Infinity;
  for (let page = 1; all.length < total; page++) {
    const xml = await call("period2", { from: today.replaceAll("-", ""), to: until.replaceAll("-", ""), PageNo: page, numOfrows: 500 });
    total = Number((xml.match(/<totalCount>(\d+)<\/totalCount>/) || [])[1] ?? 0);
    const batch = items(xml);
    if (!batch.length) break;
    all.push(...batch);
    if (page > 50) throw new Error("Too many listing pages");
  }
  if (all.length !== total) throw new Error(`Incomplete listing (${all.length}/${total}); refusing to import`);
  return all.map((xml) => ({
    seq: clean(field(xml, "seq")), title: clean(field(xml, "title")), startDate: isoDate(field(xml, "startDate")), endDate: isoDate(field(xml, "endDate")),
    place: clean(field(xml, "place")), realm: clean(field(xml, "realmName")), area: clean(field(xml, "area")), sigungu: clean(field(xml, "sigungu")),
    thumbnail: https(field(xml, "thumbnail")), longitude: Number(field(xml, "gpsX")), latitude: Number(field(xml, "gpsY")),
  }));
}

function candidate(item) {
  if (!/^\d{1,20}$/.test(item.seq)) return skip("invalid source ID");
  if (!item.title || !item.startDate || !item.endDate || item.endDate < item.startDate || item.endDate < today) return skip("missing title or dates");
  const rule = selectRule(item.realm, item.startDate, item.endDate);
  if (!rule) return skip("category or run length not selected");
  if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) || item.latitude < 33 || item.latitude > 39 || item.longitude < 124 || item.longitude > 132) return skip("missing or invalid coordinates");
  if (!/^https:\/\/www\.culture\.go\.kr\/\S+$/.test(item.thumbnail)) return skip("missing image");
  return item;
}

async function toRow(item) {
  let detail;
  try { detail = (items(await call("detail2", { seq: item.seq }))[0]) || ""; } catch { return { unverified: true }; }
  const placeAddr = clean(field(detail, "placeAddr"));
  const region = normalizeRegion(placeAddr.split(" ")[0]) || normalizeRegion(item.area);
  if (!region) return { row: skip("unknown region") };
  const image = https(field(detail, "imgUrl")) || item.thumbnail;
  if (!/^https:\/\/www\.culture\.go\.kr\/\S+$/.test(image) || image.length > 2000) return { row: skip("missing image") };
  if (!await imageAvailable(image)) return { unverified: true, reason: "image unavailable" };
  const price = clean(field(detail, "price"));
  const phone = clean(field(detail, "phone"));
  const contents = field(detail, "contents1");
  const description = [contents, price && `관람료: ${price}`, phone && `문의: ${phone}`].filter(Boolean).join("\n\n").slice(0, 3000);
  const venue = cut(item.place || placeAddr, 120);
  const address = cut(placeAddr || [item.area, item.sigungu, item.place].filter(Boolean).join(" "), 200);
  if (!venue || !address) return { row: skip("missing venue or address") };
  const title = cut(item.title, 100);
  return { row: {
    id: uuidFor(item.seq), author_id: null, country_code: "kr", timezone: "Asia/Seoul",
    source_name: sourceName, source_id: item.seq, source_url: sourceUrl, source_provider: "한국문화정보원",
    source_reference_date: null, source_synced_at: syncedAt, source_image_url: image, source_image_license: "NO_RESTRICTION", source_image_credit: null,
    ...classify(item.realm),
    title, slug: slug(title), description, region, region_code: slug(region), venue, address,
    latitude: item.latitude, longitude: item.longitude, start_date: item.startDate, end_date: item.endDate,
    official_url: website(field(detail, "url")) || website(field(detail, "placeUrl")), publication_status: "published",
  } };
}

async function activeTourapiEvents() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Provide NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (TourAPI duplicate check)");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("events").select("title,start_date,end_date,latitude,longitude").eq("source_name", "tourapi").eq("publication_status", "published").gte("end_date", today).range(offset, offset + 999);
    if (error) throw new Error(`Could not read TourAPI events (${error.code})`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.map((row) => ({ title: row.title, startDate: row.start_date, endDate: row.end_date, latitude: row.latitude, longitude: row.longitude }));
}

function sqlFor(rows, keep) {
  const quote = (value) => value === null || value === undefined ? "null" : Array.isArray(value) ? (value.length ? `array[${value.map(quote).join(", ")}]::text[]` : "'{}'::text[]") : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  const columns = Object.keys(rows[0]);
  const updates = columns.filter((column) => !["id", "author_id", "source_name", "source_id", "publication_status"].includes(column)).map((column) => `${column} = excluded.${column}`);
  // Assumes standard_conforming_strings = on (the Postgres and Supabase default).
  const upsert = `insert into public.events (${columns.join(", ")}) values\n${rows.map((row) => `(${columns.map((column) => quote(row[column])).join(", ")})`).join(",\n")}\non conflict (source_name, source_id) where source_name is not null do update set ${updates.join(", ")};\n`;
  // Same retirement as --apply: upcoming rows no longer listed or selected are hidden.
  const retire = `update public.events set publication_status = 'hidden' where source_name = '${sourceName}' and publication_status = 'published' and end_date >= '${today}' and source_id not in (${[...keep].map(quote).join(", ")});
`;
  return upsert + retire;
}

async function main() {
  const listing = await fetchListing();
  const unique = [...new Map(listing.map((item) => [item.seq, item])).values()];
  // A listing that shifted between pages repeats some items and misses others.
  if (unique.length !== listing.length) throw new Error(`Listing repeats ${listing.length - unique.length} items; refusing to import`);
  const tourapi = await activeTourapiEvents();
  const candidates = unique.map(candidate).filter(Boolean).filter((item) => !tourapi.some((festival) => sameEvent(item, festival)) || skip("already imported from TourAPI"));
  const rows = [];
  const unverified = new Set();
  let cursor = 0;
  await Promise.all(Array.from({ length: 1 }, async () => {
    while (cursor < candidates.length) {
      const item = candidates[cursor++];
      const result = await toRow(item);
      if (result.unverified) { unverified.add(item.seq); skip(result.reason || "detail unavailable"); }
      else if (result.row) rows.push(result.row);
    }
  }));
  rows.sort((a, b) => a.source_id.localeCompare(b.source_id));
  console.log(`Culture info: ${listing.length} listed (${today}~${until}); selected ${candidates.length}; usable ${rows.length}`);
  if (skipped.size) console.log("Excluded:", Object.fromEntries(skipped));
  const tally = (key) => Object.fromEntries(Object.entries(rows.reduce((all, row) => ({ ...all, [row[key]]: (all[row[key]] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]));
  console.log("By region:", tally("region"));
  if (rows.length < MIN_EVENTS) throw new Error(`Only ${rows.length} usable events; refusing to write`);

  if (sqlFile) { await writeFile(sqlFile, sqlFor(rows, new Set([...rows.map((row) => row.source_id), ...unverified])), "utf8"); console.log(`Wrote ${rows.length} upserts to ${sqlFile}`); return; }
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
    const { data, error } = await client.from("events").select("id,source_id,publication_status,end_date").eq("source_name", sourceName).range(offset, offset + 999);
    if (error) throw new Error(`Could not read existing imports (${error.code})`);
    for (const row of data) existing.set(row.source_id, row);
    if (data.length < 1000) break;
  }
  const active = [...existing.values()].filter((row) => row.publication_status === "published" && row.end_date >= today).length;
  if (active && rows.length < active * MIN_KEPT_SHARE) throw new Error(`Only ${rows.length} usable events for ${active} published; refusing to write`);
  const inserts = rows.filter((row) => !existing.has(row.source_id));
  const updates = rows.filter((row) => existing.has(row.source_id));
  for (let offset = 0; offset < inserts.length; offset += 200) {
    const { error } = await client.from("events").insert(inserts.slice(offset, offset + 200));
    if (error) throw new Error(`Could not insert culture records (${error.code})`);
  }
  for (const row of updates) {
    // Keep each row's id and moderation state; rows this sync hid come back, admin deletions stay.
    const { id, source_name, source_id, publication_status, ...fields } = row;
    const previous = existing.get(source_id);
    if (previous.publication_status === "hidden") fields.publication_status = "published";
    const { error } = await client.from("events").update(fields).eq("id", previous.id).eq("source_name", sourceName);
    if (error) throw new Error(`Could not refresh culture record (${error.code})`);
  }
  const expected = rows.filter((row) => !existing.has(row.source_id) || ["published", "hidden"].includes(existing.get(row.source_id).publication_status));
  for (let offset = 0; offset < expected.length; offset += 100) {
    const ids = expected.slice(offset, offset + 100).map((row) => row.source_id);
    const { data, error } = await publicClient.from("events").select("source_id").eq("source_name", sourceName).eq("publication_status", "published").in("source_id", ids);
    if (error || data.length !== ids.length) throw new Error("Public verification failed");
  }
  // Upcoming events that left the listing or the selection are hidden; failed checks never count as gone.
  const current = new Set(rows.map((row) => row.source_id));
  const gone = [...existing.values()].filter((row) => !current.has(row.source_id) && !unverified.has(row.source_id) && row.publication_status === "published" && row.end_date >= today).map((row) => row.id);
  for (let offset = 0; offset < gone.length; offset += 100) {
    const { error } = await client.from("events").update({ publication_status: "hidden" }).in("id", gone.slice(offset, offset + 100)).eq("source_name", sourceName);
    if (error) throw new Error(`Could not retire removed culture records (${error.code})`);
  }
  console.log(`Culture info: inserted ${inserts.length}, refreshed ${updates.length}, retired ${gone.length}; verified ${expected.length} public events.`);
}
main().catch((error) => { console.error(`Import stopped: ${error.message.replaceAll(serviceKey, "***").replaceAll(rawKey, "***")}`); process.exitCode = 1; });
