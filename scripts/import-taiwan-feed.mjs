// Imports current events from the Taiwan Tourism Administration activity open data
// (OGDL-1.0, no key, refreshed daily). Dry run by default.
//   --apply       write through the service key (GitHub Actions weekly sync)
//   --sql FILE    write a reviewed upsert for the database Management API
// Events are stored in the original Traditional Chinese, like Paris keeps French.
// The six hand-written English entries in data/taiwan-events.json stay as they are
// (scripts/import-taiwan.mjs) while they last; this feed never overwrites or retires them.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { campaignText, classifyTaiwanEvent, duplicateKey, taiwanDates, taiwanDay, taiwanRegion, TAIWAN_IMAGE_HOST } from "./taiwan-feed-lib.mjs";

const apply = process.argv.includes("--apply");
const sqlIndex = process.argv.indexOf("--sql");
const sqlFile = sqlIndex >= 0 ? process.argv[sqlIndex + 1] : null;
if (sqlIndex >= 0 && !sqlFile) throw new Error("--sql requires an output filename");
if (apply && sqlFile) throw new Error("Use either --apply or --sql");

const feed = "https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/EventList.json";
const sourceName = "taiwan_tourism";
const sourceUrl = "https://data.gov.tw/en/datasets/7778";
const syncedAt = new Date().toISOString();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
// Fewer usable events than this means the source or the filter broke; nothing is written.
const MIN_EVENTS = 20;
// A run that would keep less than this share of the currently published feed events is
// treated as a source or network failure and writes nothing.
const MIN_KEPT_SHARE = 0.7;

const curated = JSON.parse(await readFile(new URL("../data/taiwan-events.json", import.meta.url), "utf8"));
// Hand-written entries win while they are current; once they end the feed may take over.
const curatedIds = new Set(curated.events.filter((event) => event.endDate >= today).map((event) => event.sourceId));
// Other agencies' listings of a curated event whose titles differ too much to match.
const SAME_AS_CURATED = { Event_A15010000H_081727: "Event_A15010900H_005680" };

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
// By code point, so a rare supplementary character is never split in half.
const chars = (value) => Array.from(value);
const cut = (value, max) => chars(value).length <= max ? value : `${chars(value).slice(0, max - 1).join("").trimEnd()}…`;
const slug = (value) => clean(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "event";
const website = (value) => { const url = clean(value); return /^https?:\/\/\S+$/i.test(url) && url.length <= 1000 ? url : ""; };
const uuidFor = (id) => {
  const hash = createHash("sha256").update(`${sourceName}:${id}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const STATUS = { EventScheduled: "scheduled", EventRescheduled: "scheduled", EventMovedOnline: "scheduled", EventPostponed: "postponed", EventCancelled: "cancelled" };

async function imageAvailable(url) {
  try {
    // The first byte is enough to confirm the image exists and its type.
    const response = await fetch(url, { redirect: "manual", headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(15000) });
    const type = response.headers.get("content-type") || "";
    await response.body?.cancel();
    return (response.status === 200 || response.status === 206) && /^image\/(jpeg|jpg|png|webp|gif)(?:;|$)/i.test(type);
  } catch { return false; }
}

const skipped = new Map();
const skip = (reason) => { skipped.set(reason, (skipped.get(reason) || 0) + 1); return null; };
function toRow(record) {
  const id = clean(record.EventID);
  if (!/^Event_[A-Za-z0-9_]{1,80}$/.test(id)) return skip("invalid source ID");
  if (curatedIds.has(id) || curatedIds.has(SAME_AS_CURATED[id])) return skip("curated English entry");
  const title = cut(clean(record.EventName), 100);
  if (!title) return skip("missing title");
  const dates = taiwanDates(record.StartDateTime, record.EndDateTime);
  if (!dates || dates.endDate < dates.startDate) return skip("missing or invalid dates");
  const { startDate, endDate } = dates;
  if (endDate < today) return skip("ended");
  const kind = classifyTaiwanEvent(title, startDate, endDate);
  if (!kind.keep) return skip(kind.reason);
  if (campaignText(record.Description)) return skip("notice, app, campaign or class");
  const status = STATUS[record.EventStatus];
  if (!status) return skip("unknown status");
  const latitude = Number(record.PositionLat), longitude = Number(record.PositionLon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 21.8 || latitude > 26.5 || longitude < 118 || longitude > 123) return skip("missing or invalid coordinates");
  const postal = record.PostalAddress || {};
  const place = taiwanRegion(postal.City);
  if (!place) return skip("unknown city");
  const image = clean(record.Images?.[0]?.URL);
  if (!TAIWAN_IMAGE_HOST.test(image) || image.length > 2000 || /not-found/i.test(image)) return skip("missing image or unsupported image host");
  const street = clean(postal.StreetAddress);
  const area = `${clean(postal.City)}${clean(postal.Town)}`;
  const address = cut(`${area}${street}`, 200);
  const venue = cut(street || area, 120);
  if (!venue || /尚未確定|未定/.test(venue)) return skip("missing venue");
  const fee = clean(record.FeeInfo);
  const description = chars([clean(record.Description), fee && `費用：${fee}`].filter(Boolean).join("\n\n")).slice(0, 3000).join("");
  return {
    id: uuidFor(id), author_id: null, country_code: "tw", timezone: "Asia/Taipei",
    source_name: sourceName, source_id: id, source_url: sourceUrl, source_provider: "Taiwan Tourism Administration",
    source_reference_date: taiwanDay(record.UpdateTime) || today, source_synced_at: syncedAt,
    source_image_url: image, source_image_license: "OGDL-1.0",
    category: kind.category, tags: kind.tags,
    title, slug: slug(title), description, region: place.region, region_code: place.code, venue, address,
    latitude, longitude, start_date: startDate, end_date: endDate,
    official_url: website(record.WebsiteURL) || website(record.SameAsURLs?.[0]), event_status: status, publication_status: "published",
  };
}

async function fetchRecords() {
  const response = await fetch(feed, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Taiwan open data request failed (${response.status})`);
  const data = JSON.parse((await response.text()).replace(/^﻿/, ""));
  if (!Array.isArray(data?.Events)) throw new Error("Unexpected Taiwan open data response");
  return data.Events;
}

function sqlFor(rows) {
  const quote = (value) => value === null || value === undefined ? "null" : Array.isArray(value) ? (value.length ? `array[${value.map(quote).join(", ")}]::text[]` : "'{}'::text[]") : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  const columns = Object.keys(rows[0]);
  const updates = columns.filter((column) => !["id", "author_id", "source_name", "source_id", "publication_status"].includes(column)).map((column) => `${column} = excluded.${column}`);
  return `insert into public.events (${columns.join(", ")}) values\n${rows.map((row) => `(${columns.map((column) => quote(row[column])).join(", ")})`).join(",\n")}\non conflict (source_name, source_id) where source_name is not null do update set ${updates.join(", ")};\n`;
}

async function readExisting(client) {
  const existing = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("events").select("id,source_id,publication_status,end_date").eq("source_name", sourceName).range(offset, offset + 999);
    if (error) throw new Error(`Could not read existing imports (${error.code})`);
    for (const row of data) if (!curatedIds.has(row.source_id)) existing.set(row.source_id, row);
    if (data.length < 1000) break;
  }
  return existing;
}

async function main() {
  // In apply mode the existing rows are read first, so dedupe keeps an already published
  // listing (its saves and links) instead of swapping in another agency's copy.
  let client = null, publicClient = null, existing = new Map();
  if (apply) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_IMPORT_SERVICE_KEY;
    const ref = process.env.SUPABASE_IMPORT_PROJECT_REF;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !service || !ref || !publicKey || new URL(url).hostname !== `${ref}.supabase.co`) throw new Error("Provide SUPABASE_IMPORT_SERVICE_KEY and matching SUPABASE_IMPORT_PROJECT_REF");
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    client = createClient(url, service, options);
    publicClient = createClient(url, publicKey, options);
    existing = await readExisting(client);
  }
  const records = await fetchRecords();
  const unique = [...new Map(records.map((record) => [clean(record.EventID), record])).values()];
  const shaped = unique.map(toRow).filter(Boolean);
  // Every candidate's image is checked first, so a duplicate can stand in when the
  // preferred listing's image fails.
  const working = new Set();
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < shaped.length) {
      const row = shaped[cursor++];
      if (await imageAvailable(row.source_image_url)) working.add(row.source_id);
    }
  }));
  // One row per event when several agencies list it: an already published listing first,
  // then the national listing (taiwan.net.tw), then the lowest ID, so the same record wins
  // on every run. Listings of a current curated event are dropped.
  const published = (row) => existing.get(row.source_id)?.publication_status === "published";
  const preferred = (row) => `${published(row) ? 0 : 1}:${/taiwan\.net\.tw\//.test(row.source_image_url) ? 0 : 1}:${row.source_id}`;
  const curatedKeys = new Set(unique.filter((record) => curatedIds.has(clean(record.EventID))).flatMap((record) => {
    const place = taiwanRegion(record.PostalAddress?.City);
    return place ? [duplicateKey(clean(record.EventName), place.code)] : [];
  }));
  const groups = new Map();
  for (const row of shaped) {
    const key = duplicateKey(row.title, row.region_code);
    if (curatedKeys.has(key)) { skip("curated English entry"); continue; }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const rows = [];
  // Events whose image check failed (timeouts, blocked hosts) are kept as they are, not
  // retired; that covers every listing in the group so no duplicate is retired either.
  const unverified = new Set();
  for (const group of groups.values()) {
    group.sort((a, b) => preferred(a).localeCompare(preferred(b)));
    const winner = group.find((row) => working.has(row.source_id));
    if (group.some((row) => !working.has(row.source_id))) for (const row of group) unverified.add(row.source_id);
    if (!winner) { skip("image unavailable"); continue; }
    rows.push(winner);
    for (let i = 1; i < group.length; i++) skip("duplicate listing");
  }
  rows.sort((a, b) => a.source_id.localeCompare(b.source_id));
  console.log(`Taiwan records: ${records.length} (unique ${unique.length}); usable ${rows.length}; Taipei date ${today}`);
  if (skipped.size) console.log("Excluded:", Object.fromEntries(skipped));
  const count = (key) => rows.reduce((all, row) => ({ ...all, [row[key]]: (all[row[key]] || 0) + 1 }), {});
  console.log("By region:", count("region"));
  console.log("By category:", count("category"));
  if (rows.length < MIN_EVENTS) throw new Error(`Only ${rows.length} usable events; refusing to write`);

  if (sqlFile) { await writeFile(sqlFile, sqlFor(rows), "utf8"); console.log(`Wrote ${rows.length} upserts to ${sqlFile}`); return; }
  if (!apply) { console.log("Dry run only; add --apply to write."); return; }

  const active = [...existing.values()].filter((row) => row.publication_status === "published" && row.end_date >= today).length;
  if (active && rows.length < active * MIN_KEPT_SHARE) throw new Error(`Only ${rows.length} usable events for ${active} published; refusing to write`);
  const inserts = rows.filter((row) => !existing.has(row.source_id));
  const updates = rows.filter((row) => existing.has(row.source_id));
  for (let offset = 0; offset < inserts.length; offset += 200) {
    const { error } = await client.from("events").insert(inserts.slice(offset, offset + 200));
    if (error) throw new Error(`Could not insert Taiwan records (${error.code})`);
  }
  for (const row of updates) {
    // Keep each row's id and moderation state; refresh the content. Rows this sync
    // retired earlier ("hidden") come back; admin deletions ("deleted") stay.
    const { id, source_name, source_id, publication_status, ...fields } = row;
    const previous = existing.get(source_id);
    if (previous.publication_status === "hidden") fields.publication_status = "published";
    const { error } = await client.from("events").update(fields).eq("id", previous.id).eq("source_name", sourceName);
    if (error) throw new Error(`Could not refresh Taiwan record (${error.code})`);
  }
  // Public RLS must expose every new or already-public record.
  const expected = rows.filter((row) => !existing.has(row.source_id) || ["published", "hidden"].includes(existing.get(row.source_id).publication_status));
  for (let offset = 0; offset < expected.length; offset += 100) {
    const ids = expected.slice(offset, offset + 100).map((row) => row.source_id);
    const { data, error } = await publicClient.from("events").select("source_id").eq("source_name", sourceName).eq("publication_status", "published").in("source_id", ids);
    if (error || data.length !== ids.length) throw new Error("Public verification failed");
  }
  // Upcoming events that left the feed (cancelled, removed, or now filtered out) are
  // hidden, not deleted, so reports and saves keep their rows and a returning event is
  // published again. Unverified images and the curated entries never count as gone.
  const current = new Set(rows.map((row) => row.source_id));
  const gone = [...existing.values()].filter((row) => !current.has(row.source_id) && !unverified.has(row.source_id) && row.publication_status === "published" && row.end_date >= today).map((row) => row.id);
  for (let offset = 0; offset < gone.length; offset += 100) {
    const { error } = await client.from("events").update({ publication_status: "hidden" }).in("id", gone.slice(offset, offset + 100)).eq("source_name", sourceName);
    if (error) throw new Error(`Could not retire removed Taiwan records (${error.code})`);
  }
  console.log(`Taiwan: inserted ${inserts.length}, refreshed ${updates.length}, retired ${gone.length}; verified ${expected.length} public events.`);
}
main().catch((error) => { console.error(`Import stopped: ${error.message}`); process.exitCode = 1; });
