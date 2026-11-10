import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const countrySource = await readFile(new URL("../src/lib/countries.ts", import.meta.url), "utf8");
const countryCompiled = ts.transpileModule(countrySource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const countryModuleUrl = `data:text/javascript;base64,${Buffer.from(countryCompiled).toString("base64")}`;
const richSource = await readFile(new URL("../src/lib/rich-text.ts", import.meta.url), "utf8");
const richCompiled = ts.transpileModule(richSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const richModuleUrl = `data:text/javascript;base64,${Buffer.from(richCompiled).toString("base64")}`;
const { normalizeRichText, richTextPlain, plainTextDocument } = await import(richModuleUrl);
const source = await readFile(
  new URL("../src/lib/event-validation.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(
  source.replace('"./countries"', JSON.stringify(countryModuleUrl)).replace('"./rich-text"', JSON.stringify(richModuleUrl)).replace(
    '"zod"',
    JSON.stringify(pathToFileURL(require.resolve("zod")).href),
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const { eventInputSchema, makeSlug } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const valid = {
  id: crypto.randomUUID(),
  title: "우리 동네 행사",
  description: "동네에서 함께 즐기는 행사입니다.",
  region: "서울 성동구",
  venue: "동네 광장",
  address: "",
  latitude: 37.56,
  longitude: 126.98,
  startDate: "2027-03-01",
  endDate: "2027-03-02",
  officialUrl: "",
  publicationStatus: "draft",
};
test("reject invalid dates, date order, nonfinite coordinates, privileged statuses and unsafe links", () => {
  assert(eventInputSchema.safeParse(valid).success);
  for (const override of [
    { startDate: "2027-02-30" },
    { endDate: "2020-01-01" },
    { latitude: NaN },
    { longitude: Infinity },
    { publicationStatus: "hidden" },
    { officialUrl: "javascript:alert(1)" },
  ])
    assert(!eventInputSchema.safeParse({ ...valid, ...override }).success);
  assert(
    eventInputSchema.safeParse({ ...valid, startDate: null, endDate: null })
      .success,
  );
});

test("a short introduction is required while region, venue and link may be empty", () => {
  assert(!eventInputSchema.safeParse({ ...valid, description: "   " }).success);
  assert(eventInputSchema.safeParse({ ...valid, description: "작은 동네 축제", region: "", venue: "", officialUrl: "" }).success);
});

test("formatted introductions retain matching text and accept up to 20000 characters", () => {
  const doc = normalizeRichText({ type: "doc", content: [
    { type: "heading", attrs: { level: 2, onclick: "bad" }, content: [{ type: "text", text: "프로그램" }] },
    { type: "paragraph", content: [{ type: "text", text: "공연과 체험", marks: [{ type: "bold" }] }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "공식 안내", marks: [{ type: "link", attrs: { href: "https://example.com/", onclick: "bad" } }] }] }] }] },
  ] });
  assert(doc);
  assert.equal(richTextPlain(doc), "프로그램\n공연과 체험\n공식 안내");
  assert.equal(JSON.stringify(doc).includes("onclick"), false);
  assert(eventInputSchema.safeParse({ ...valid, description: richTextPlain(doc), descriptionContent: doc }).success);
  assert(!eventInputSchema.safeParse({ ...valid, descriptionContent: doc }).success);
  assert(eventInputSchema.safeParse({ ...valid, description: "가".repeat(20000), descriptionContent: plainTextDocument("가".repeat(20000)) }).success);
  assert(!eventInputSchema.safeParse({ ...valid, description: "가".repeat(20001) }).success);
  assert(!eventInputSchema.safeParse({ ...valid, description: " ", descriptionContent: plainTextDocument("") }).success);
});

test("rich descriptions reject unsafe links, embedded HTML/images and excessive nesting", () => {
  const link = (href) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href } }] }] }] });
  assert.equal(normalizeRichText(link("javascript:alert(1)")), null);
  assert.equal(normalizeRichText(link("data:text/html,test")), null);
  assert.equal(normalizeRichText({ type: "doc", content: [{ type: "image", attrs: { src: "https://example.com/x.jpg" } }] }), null);
  assert.equal(normalizeRichText({ type: "doc", content: [{ type: "html", text: "<script>alert(1)</script>" }] }), null);
  let node = { type: "paragraph", content: [{ type: "text", text: "test" }] };
  for (let depth = 0; depth < 14; depth++) node = { type: "blockquote", content: [node] };
  assert.equal(normalizeRichText({ type: "doc", content: [node] }), null);
  const literal = "<img src=x onerror=alert(1)>";
  assert.equal(richTextPlain(normalizeRichText(plainTextDocument(literal))), literal);
});
test("slug creation supports Korean titles", () => {
  assert.equal(makeSlug("  성수 골목 마켓!  "), "성수-골목-마켓");
});
test("legacy Korean slugs decode and event links open explorer modals", async () => {
  const source = await readFile(
    new URL("../src/lib/events.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source.replace('"./countries"', JSON.stringify(countryModuleUrl)), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const { decodeRouteSegment, eventPath } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
  const slug = "성수-골목-마켓";
  assert.equal(decodeRouteSegment(encodeURIComponent(slug)), slug);
  assert.equal(decodeRouteSegment(slug), slug);
  assert.equal(
    eventPath({ id: "example", slug }),
    "/korea?event=example",
  );
  assert.equal(eventPath({ id: "example", countryCode: "tw" }), "/taiwan?event=example");
});

test("geocoding results reject malformed, foreign and out-of-range locations", async () => {
  const source = await readFile(new URL("../src/lib/geocoding.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source.replace('"./countries"', JSON.stringify(countryModuleUrl)).replace('"zod"', JSON.stringify(pathToFileURL(require.resolve("zod")).href)), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const { addressResults } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  const valid = { lat: 37.5665, lon: 126.9784, country_code: "kr", formatted: "서울특별시 중구 세종대로 110", name: "서울시청", state: "서울특별시", city: "서울특별시", district: "중구", result_type: "building", place_id: "seoul" };
  const results = addressResults({ results: [valid, valid, { ...valid, place_id: "foreign", country_code: "jp" }, { ...valid, place_id: "outside", lat: 10 }, { ...valid, place_id: "invalid", lon: NaN }, null] });
  assert.equal(results.length, 1);
  assert.equal(results[0].region, "서울특별시 중구");
  assert.equal(results[0].venue, "서울시청");
  assert.equal(results[0].approximate, false);
  assert.equal(addressResults({ results: [{ ...valid, result_type: "city" }] })[0].approximate, true);
  assert.deepEqual(addressResults({ error: "not results" }), []);
  const taiwan = { ...valid, lat: 25.0379, lon: 121.5631, country_code: "tw", place_id: "taipei", formatted: "Taipei City Hall, Taiwan" };
  assert.equal(addressResults({ results: [valid, taiwan] }, "tw").length, 1);
  assert.equal(addressResults({ results: [taiwan] }).length, 0);
});

test("Taiwan location validation rejects country-coordinate mismatches", () => {
  assert.equal(eventInputSchema.safeParse({ ...valid, countryCode: "tw", latitude: 25.0379, longitude: 121.5631 }).success, true);
  assert.equal(eventInputSchema.safeParse({ ...valid, countryCode: "tw" }).success, false);
  assert.equal(eventInputSchema.safeParse({ ...valid, countryCode: "kr", latitude: 25.0379, longitude: 121.5631 }).success, false);
  assert.equal(eventInputSchema.safeParse({ ...valid, countryCode: "jp" }).success, false);
});
