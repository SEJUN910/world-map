// Curated English summaries of official Taiwan tourism open data. Dry run by
// default. --sql FILE writes a reviewed upsert for the project database MCP.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const dataset = JSON.parse(await readFile(new URL("../data/taiwan-events.json", import.meta.url), "utf8"));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const rows = [];
for (const event of dataset.events) {
  if (event.endDate < today) continue;
  if (!/^Event_[A-Za-z0-9_]{1,80}$/.test(event.sourceId) || !event.description.trim() || event.title.length > 100 || event.endDate < event.startDate) throw Error("Invalid curated Taiwan event");
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude) || event.latitude < 21.8 || event.latitude > 26.5 || event.longitude < 118 || event.longitude > 123) throw Error("Invalid Taiwan coordinates");
  const url = new URL(event.poster);
  if (url.protocol !== "https:" || !/(^|\.)(gov\.tw|taiwan\.net\.tw)$/.test(url.hostname)) throw Error("Unexpected image host");
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const type = response.headers.get("content-type") || "";
  await response.body?.cancel();
  if (!response.ok || !type.startsWith("image/")) throw Error(`Image unavailable: ${event.sourceId}`);
  const hash = createHash("sha256").update(`taiwan_tourism:${event.sourceId}`).digest("hex");
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  rows.push({ id, author_id: null, country_code: "tw", timezone: "Asia/Taipei", slug: event.title.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0,80), title: event.title, description: event.description, region: event.region, region_code: event.regionCode, venue: event.venue, address: event.address, latitude: event.latitude, longitude: event.longitude, start_date: event.startDate, end_date: event.endDate, official_url: event.officialUrl, publication_status: "published", event_status: "scheduled", source_name: "taiwan_tourism", source_id: event.sourceId, source_url: dataset.source, source_provider: "Taiwan Tourism Administration", source_reference_date: dataset.referenceDate, source_synced_at: new Date().toISOString(), source_image_url: event.poster, source_image_license: "OGDL-1.0" });
}
if (!rows.length) throw Error("No current Taiwan events; refresh the curated dataset first");
const option = process.argv.indexOf("--sql");
if (option >= 0) {
  const filename = process.argv[option + 1];
  if (!filename) throw Error("--sql requires an output filename");
  const quote = (value) => value === null ? "null" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  const columns = Object.keys(rows[0]);
  const sql = `insert into public.events (${columns.join(",")}) values\n${rows.map((row) => `(${columns.map((key) => quote(row[key])).join(",")})`).join(",\n")}\non conflict (source_name,source_id) where source_name is not null do update set ${columns.filter((key) => !["id","author_id","source_name","source_id","publication_status"].includes(key)).map((key) => `${key}=excluded.${key}`).join(",")};\n`;
  await writeFile(filename, sql, "utf8");
}
console.log(JSON.stringify({ mode: option >= 0 ? "sql-written-not-applied" : "dry-run", count: rows.length, imagesVerified: true, titles: rows.map((row) => row.title) }));
