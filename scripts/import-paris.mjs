// Imports festivals, exhibitions and fairs from the City of
// Paris open data "Que faire à Paris" (ODbL, no key). Dry run by default.
//   --apply       write through the service key (GitHub Actions weekly sync)
//   --sql FILE    write a reviewed upsert for the database Management API
// Events are stored in the original French with the photographer's credit.
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const sqlIndex = process.argv.indexOf("--sql");
const sqlFile = sqlIndex >= 0 ? process.argv[sqlIndex + 1] : null;
if (sqlIndex >= 0 && !sqlFile) throw new Error("--sql requires an output filename");
if (apply && sqlFile) throw new Error("Use either --apply or --sql");

const dataset = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/exports/json";
const sourceName = "paris_qfap";
const sourceUrl = "https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/";
const syncedAt = new Date().toISOString();
const parisDate = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const today = parisDate(Date.now());
// The listing stores calendar days as UTC instants (start 00:00Z, end 23:59Z), so the
// day is the UTC date; converting to Paris time would push most end dates a day later.
const listingDate = (value) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 10);
};
// Fewer usable events than this means the source or the filter broke; nothing is written.
const MIN_EVENTS = 20;
// A run that would keep less than this share of the currently published events is
// treated as a source or network failure and writes nothing.
const MIN_KEPT_SHARE = 0.7;

// Selection: what a visitor would plan a trip around, not one-evening shows or workshops.
const EXCLUDED = ["Atelier", "Conférence", "Santé", "Solidarité", "Prévention", "Handicap", "Senior"];
const RULES = [
  { tags: ["Festival"], minDays: 0, maxDays: 180 },
  { tags: ["Expo", "Art contemporain", "Photo", "Peinture", "Street-art", "BD"], minDays: 0, maxDays: 120 },
  { tags: ["Gourmand", "Salon", "Brocante"], minDays: 0, maxDays: 30 },
  // Plain concerts and plays (hundreds of single dates and long runs) are left out;
  // shows that are part of a festival come in through the festival rule.
];

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const slug = (value) => clean(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "event";
const cut = (value, max) => value.length <= max ? value : `${value.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï", euml: "ë", oelig: "œ", Eacute: "É", Agrave: "À", Ccedil: "Ç", euro: "€", deg: "°" };
function plainText(html) {
  return String(html ?? "")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/gi, (match, code) => {
      if (code[0] !== "#") return ENTITIES[code] ?? match;
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      // Only real characters: no NUL (Postgres rejects it), surrogates or out-of-range values.
      return point >= 1 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff) ? String.fromCodePoint(point) : "";
    })
    .replace(/\u0000/g, "")
    .split("\n").map((line) => line.replace(/[ \t ]+/g, " ").trim()).filter(Boolean).join("\n");
}
const tagsOf = (record) => clean(record.qfap_tags).split(";").map((tag) => tag.trim()).filter(Boolean);
const days = (start, end) => (Date.parse(end) - Date.parse(start)) / 86_400_000;
function region(zipcode) {
  const zip = clean(zipcode);
  const match = /^75(0(?:0[1-9]|1\d|20)|116)$/.exec(zip);
  if (!match) return { region: "Grand Paris", code: "grand-paris" };
  const n = match[1] === "116" ? 16 : Number(match[1].slice(1));
  return { region: `Paris ${n}${n === 1 ? "er" : "e"}`, code: `paris-${String(n).padStart(2, "0")}` };
}
function website(value) {
  const url = clean(value);
  return /^https?:\/\/\S+$/i.test(url) && url.length <= 1000 ? url : "";
}
const uuidFor = (id) => {
  const hash = createHash("sha256").update(`${sourceName}:${id}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
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
function selected(record) {
  const tags = tagsOf(record);
  if (!tags.length) return skip("no category");
  if (tags.some((tag) => EXCLUDED.includes(tag))) return skip("workshop/talk/service category");
  const start = listingDate(record.date_start), end = listingDate(record.date_end);
  if (!start || !end) return skip("missing dates");
  const length = days(start, end);
  if (!RULES.some((rule) => tags.some((tag) => rule.tags.includes(tag)) && length >= rule.minDays && length <= rule.maxDays)) return skip("not a festival/exhibition/fair/run, or permanent");
  return true;
}
function toRow(record) {
  const id = clean(record.id);
  if (!/^\d{1,20}$/.test(id)) return skip("invalid source ID");
  const title = cut(clean(record.title), 100);
  const image = clean(record.cover_url);
  const latitude = Number(record.lat_lon?.lat), longitude = Number(record.lat_lon?.lon);
  if (!title) return skip("missing title");
  const startDate = listingDate(record.date_start), endDate = listingDate(record.date_end);
  if (!startDate || !endDate) return skip("missing dates");
  if (endDate < startDate || endDate < today) return skip("ended or invalid dates");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 41.3 || latitude > 51.2 || longitude < -5.5 || longitude > 9.8) return skip("missing or invalid coordinates");
  if (!/^https:\/\/cdn\.paris\.fr\/\S+$/.test(image) || image.length > 2000) return skip("missing image");
  const street = clean(record.address_street);
  const city = [clean(record.address_zipcode), clean(record.address_city)].filter(Boolean).join(" ");
  const address = cut([street, city].filter(Boolean).join(", "), 200);
  const venue = cut(clean(record.address_name) || street || city, 120);
  if (!venue || !address) return skip("missing venue or address");
  const place = region(record.address_zipcode);
  const price = [clean(record.price_type), plainText(record.price_detail)].filter(Boolean).join(" — ");
  const description = [plainText(record.lead_text), plainText(record.description), price && `Tarif : ${price}`].filter(Boolean).join("\n\n").slice(0, 3000);
  const credit = clean(record.cover_credit).slice(0, 200) || null;
  return {
    id: uuidFor(id), author_id: null, country_code: "fr", timezone: "Europe/Paris",
    source_name: sourceName, source_id: id, source_url: sourceUrl, source_provider: "Ville de Paris",
    source_reference_date: listingDate(record.updated_at), source_synced_at: syncedAt,
    source_image_url: image, source_image_license: "ODbL", source_image_credit: credit,
    title, slug: slug(title), description, region: place.region, region_code: place.code, venue, address,
    latitude, longitude, start_date: startDate, end_date: endDate,
    official_url: website(record.url) || website(record.access_link), publication_status: "published",
  };
}

async function fetchRecords() {
  const fields = "id,title,lead_text,description,date_start,date_end,cover_url,cover_credit,address_name,address_street,address_zipcode,address_city,lat_lon,url,access_link,price_type,price_detail,qfap_tags,updated_at";
  const url = `${dataset}?select=${encodeURIComponent(fields)}&where=${encodeURIComponent("date_end >= now()")}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Paris open data request failed (${response.status})`);
  const records = await response.json();
  if (!Array.isArray(records)) throw new Error("Unexpected Paris open data response");
  return records;
}

function sqlFor(rows) {
  const quote = (value) => value === null || value === undefined ? "null" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  const columns = Object.keys(rows[0]);
  const updates = columns.filter((column) => !["id", "author_id", "source_name", "source_id", "publication_status"].includes(column)).map((column) => `${column} = excluded.${column}`);
  return `insert into public.events (${columns.join(", ")}) values\n${rows.map((row) => `(${columns.map((column) => quote(row[column])).join(", ")})`).join(",\n")}\non conflict (source_name, source_id) where source_name is not null do update set ${updates.join(", ")};\n`;
}

async function main() {
  const records = await fetchRecords();
  const unique = [...new Map(records.map((record) => [clean(record.id), record])).values()];
  const candidates = unique.filter(selected);
  const shaped = candidates.map(toRow).filter(Boolean);
  const rows = [];
  // Events whose image check failed (timeouts, CDN hiccups) are kept as they are, not retired.
  const unverified = new Set();
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < shaped.length) {
      const row = shaped[cursor++];
      if (await imageAvailable(row.source_image_url)) rows.push(row); else { unverified.add(row.source_id); skip("image unavailable"); }
    }
  }));
  rows.sort((a, b) => a.source_id.localeCompare(b.source_id));
  console.log(`Paris records: ${records.length} (unique ${unique.length}); selected ${candidates.length}; usable ${rows.length}; Paris date ${today}`);
  if (skipped.size) console.log("Excluded:", Object.fromEntries(skipped));
  const byRegion = {};
  for (const row of rows) byRegion[row.region] = (byRegion[row.region] || 0) + 1;
  console.log("By region:", byRegion);
  if (rows.length < MIN_EVENTS) throw new Error(`Only ${rows.length} usable events; refusing to write`);

  if (sqlFile) { await writeFile(sqlFile, sqlFor(rows), "utf8"); console.log(`Wrote ${rows.length} upserts to ${sqlFile}`); return; }
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
    if (error) throw new Error(`Could not insert Paris records (${error.code})`);
  }
  for (const row of updates) {
    // Keep each row's id and moderation state; refresh the content. Rows this sync
    // retired earlier ("hidden") come back; admin deletions ("deleted") stay.
    const { id, source_name, source_id, publication_status, ...fields } = row;
    const previous = existing.get(source_id);
    if (previous.publication_status === "hidden") fields.publication_status = "published";
    const { error } = await client.from("events").update(fields).eq("id", previous.id).eq("source_name", sourceName);
    if (error) throw new Error(`Could not refresh Paris record (${error.code})`);
  }
  // Public RLS must expose every new or already-public record.
  const expected = rows.filter((row) => !existing.has(row.source_id) || ["published", "hidden"].includes(existing.get(row.source_id).publication_status));
  for (let offset = 0; offset < expected.length; offset += 100) {
    const ids = expected.slice(offset, offset + 100).map((row) => row.source_id);
    const { data, error } = await publicClient.from("events").select("source_id").eq("source_name", sourceName).eq("publication_status", "published").in("source_id", ids);
    if (error || data.length !== ids.length) throw new Error("Public verification failed");
  }
  // Upcoming events that left the listing (cancelled, removed, or now filtered out)
  // are hidden, not deleted, so reports and saves keep their rows and a returning
  // event is published again. Unverified images never count as gone.
  const current = new Set(rows.map((row) => row.source_id));
  const gone = [...existing.values()].filter((row) => !current.has(row.source_id) && !unverified.has(row.source_id) && row.publication_status === "published" && row.end_date >= today).map((row) => row.id);
  for (let offset = 0; offset < gone.length; offset += 100) {
    const { error } = await client.from("events").update({ publication_status: "hidden" }).in("id", gone.slice(offset, offset + 100)).eq("source_name", sourceName);
    if (error) throw new Error(`Could not retire removed Paris records (${error.code})`);
  }
  console.log(`Paris: inserted ${inserts.length}, refreshed ${updates.length}, retired ${gone.length}; verified ${expected.length} public events.`);
}
main().catch((error) => { console.error(`Import stopped: ${error.message}`); process.exitCode = 1; });
