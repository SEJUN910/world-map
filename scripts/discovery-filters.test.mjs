import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = name => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const countries = compile(await file("countries"));
const eventTags = compile(await file("event-tags"));
const { selectVisibleTags, countTags } = await import(eventTags);
const eventThemes = compile(await file("event-themes"));
const { EVENT_THEMES, themeClause, isEventTheme } = await import(eventThemes);
const events = compile((await file("events")).replace('"./countries"', JSON.stringify(countries)));
const { normalizeDiscoveryFilters, discoveryDateRange, parseBounds, discoveryParams, applyDiscoveryFilters } = await import(compile((await file("discovery-filters")).replace('"./event-categories"', JSON.stringify(compile(await file("event-categories")))).replace('"./event-tags"', JSON.stringify(eventTags)).replace('"./event-themes"', JSON.stringify(eventThemes)).replace('"./events"', JSON.stringify(events))));
const filter = when => normalizeDiscoveryFilters({ when });

test("weekends include Sunday and cross year boundaries; month includes only remaining days", () => {
  assert.deepEqual(discoveryDateRange(filter("weekend"), "kr", "2026-11-12"), { from: "2026-11-14", to: "2026-11-15" });
  assert.deepEqual(discoveryDateRange(filter("weekend"), "tw", "2026-11-15"), { from: "2026-11-14", to: "2026-11-15" });
  assert.deepEqual(discoveryDateRange(filter("weekend"), "kr", "2027-12-31"), { from: "2028-01-01", to: "2028-01-02" });
  assert.deepEqual(discoveryDateRange(filter("month"), "kr", "2028-02-10"), { from: "2028-02-10", to: "2028-02-29" });
  assert.deepEqual(discoveryDateRange(filter("today"), "tw", "2026-11-12"), { from: "2026-11-12", to: "2026-11-12" });
  assert.equal(discoveryDateRange(filter("all"), "kr"), null);
});

test("malformed date and map filters cannot enter database expressions or canonical URLs", () => {
  for (const values of [{when:"custom",from:"2026-02-30",to:"2026-03-01"},{when:"custom",from:"2026-12-02",to:"2026-12-01"},{when:"garbage"}]) assert.equal(normalizeDiscoveryFilters(values).when,"all");
  for (const value of ["0,0,181,1", "0,-86,1,1", "1,0,0,1", "0,1,1,0", "0,0,1,1),id.neq.null", "170,0,-170,1"]) assert.equal(parseBounds(value),null);
  assert.equal(normalizeDiscoveryFilters({bounds:"0,0,0.000001,1"}).bounds, "");
  const valid = normalizeDiscoveryFilters({when:"custom",from:"2028-02-29",to:"2028-03-01",bounds:"120.123456,22,122,25"});
  assert.deepEqual(discoveryDateRange(valid,"tw"),{from:"2028-02-29",to:"2028-03-01"});
  assert.equal(discoveryParams(valid).bounds,"120.12346,22,122,25");
  assert.deepEqual(discoveryParams(filter("all")),{});
});

test("catalog and map filters use inclusive event overlap and exclude undated events", () => {
  const calls=[];
  const request={lte:(...args)=>{calls.push(["lte",...args]);return request;},gte:(...args)=>{calls.push(["gte",...args]);return request;},or:value=>{calls.push(["or",value]);return request;}};
  applyDiscoveryFilters(request,normalizeDiscoveryFilters({when:"custom",from:"2026-11-14",to:"2026-11-15",bounds:"120,22,122,25"}),"tw");
  assert.deepEqual(calls,[
    ["lte","start_date","2026-11-15"],
    ["or","end_date.gte.2026-11-14,and(end_date.is.null,start_date.gte.2026-11-14)"],
    ["gte","longitude",120],["lte","longitude",122],["gte","latitude",22],["lte","latitude",25]
  ]);
});

test("category filter accepts only known categories, travels in URLs and filters the query", () => {
  assert.equal(normalizeDiscoveryFilters({ category: "exhibition" }).category, "exhibition");
  for (const value of [undefined, "", "music", "Exhibition", ["festival"], "__proto__"]) assert.equal(normalizeDiscoveryFilters({ category: value }).category, "", String(value));
  assert.deepEqual(discoveryParams(normalizeDiscoveryFilters({ category: "performance" })), { category: "performance" });
  assert.deepEqual(discoveryParams(normalizeDiscoveryFilters({})), {});
  const calls = [];
  const request = { lte: (...args) => (calls.push(["lte", ...args]), request), gte: (...args) => (calls.push(["gte", ...args]), request), or: (...args) => (calls.push(["or", ...args]), request), eq: (...args) => (calls.push(["eq", ...args]), request) };
  applyDiscoveryFilters(request, normalizeDiscoveryFilters({ category: "festival" }), "kr");
  assert.deepEqual(calls, [["eq", "category", "festival"]]);
});

test("tag filter needs a category and a known tag, travels in URLs and narrows the query", () => {
  assert.equal(normalizeDiscoveryFilters({ category: "performance", tag: "musical" }).tag, "musical");
  for (const input of [{ tag: "concert" }, { category: "performance", tag: "exhibition" }, { category: "performance", tag: "festival" }, { category: "performance", tag: "invalid_tag!" }, { category: "performance", tag: "Concert" }, { category: "performance", tag: ["concert"] }, { category: "performance", tag: "__proto__" }, { category: "bogus", tag: "concert" }])
    assert.equal(normalizeDiscoveryFilters(input).tag, "", JSON.stringify(input));
  assert.deepEqual(discoveryParams(normalizeDiscoveryFilters({ category: "performance", tag: "theater" })), { category: "performance", tag: "theater" });
  const calls = [];
  const request = { lte: (...args) => (calls.push(["lte", ...args]), request), gte: (...args) => (calls.push(["gte", ...args]), request), or: (...args) => (calls.push(["or", ...args]), request), eq: (...args) => (calls.push(["eq", ...args]), request), contains: (...args) => (calls.push(["contains", ...args]), request) };
  applyDiscoveryFilters(request, normalizeDiscoveryFilters({ category: "performance", tag: "gugak" }), "kr");
  assert.deepEqual(calls, [["eq", "category", "performance"], ["contains", "tags", ["gugak"]]]);
});

test("tag chips: labelled, at least 2 events, not on every event, top 8, two or more", () => {
  const korea = { concert: 320, theater: 112, musical: 70, dance: 33, gugak: 20 };
  assert.deepEqual(selectVisibleTags(korea, 555, ""), ["concert", "theater", "musical", "dance", "gugak"]);
  assert.deepEqual(selectVisibleTags({ exhibition: 207 }, 207, ""), []);
  assert.deepEqual(selectVisibleTags({ festival: 44 }, 44, ""), []);
  const paris = { exhibition: 188, "contemporary-art": 83, photo: 58, painting: 30, theater: 24, kids: 15, nature: 12, literature: 12, walk: 11, history: 10, comics: 9, dance: 9, musical: 1, unknown: 50 };
  assert.deepEqual(selectVisibleTags(paris, 188, ""), ["contemporary-art", "photo", "painting", "theater", "kids", "literature", "nature", "walk"]);
  // A tag on every event cannot narrow; a single remaining chip is hidden.
  assert.deepEqual(selectVisibleTags({ concert: 10, dance: 3 }, 10, ""), []);
  // An active tag outside the list stays visible so it can be cleared.
  assert.deepEqual(selectVisibleTags(paris, 188, "comics"), ["comics", "contemporary-art", "photo", "painting", "theater", "kids", "literature", "nature", "walk"]);
  assert.deepEqual(selectVisibleTags({}, 0, "musical"), ["musical"]);
  assert.deepEqual(selectVisibleTags(korea, 555, "dance"), ["concert", "theater", "musical", "dance", "gugak"]);
  assert.deepEqual(countTags([{ tags: ["a", "b"] }, { tags: ["a", "a"] }, { tags: null }, {}]), { a: 2, b: 1 });
});

test("theme filter accepts only known themes, travels in URLs and adds one or-clause", () => {
  assert.equal(normalizeDiscoveryFilters({ theme: "kids" }).theme, "kids");
  for (const value of [undefined, "", "Kids", "couple", ["kids"], "__proto__", "constructor"]) assert.equal(normalizeDiscoveryFilters({ theme: value }).theme, "", String(value));
  assert.deepEqual(discoveryParams(normalizeDiscoveryFilters({ theme: "date" })), { theme: "date" });
  assert.deepEqual(discoveryParams(normalizeDiscoveryFilters({ category: "performance", theme: "kids" })), { category: "performance", theme: "kids" });
  const calls = [];
  const request = { lte: () => request, gte: () => request, eq: (...args) => (calls.push(["eq", ...args]), request), or: (...args) => (calls.push(["or", ...args]), request), contains: () => request };
  applyDiscoveryFilters(request, normalizeDiscoveryFilters({ theme: "kids" }), "kr");
  assert.equal(calls.length, 1);
  assert.ok(calls[0][1].startsWith("tags.cs.{kids},tags.cs.{circus},title.ilike.*어린이*"), calls[0][1]);
});

test("every theme has a label, known tags and words that are safe inside a PostgREST filter", () => {
  for (const [key, theme] of Object.entries(EVENT_THEMES)) {
    assert.ok(isEventTheme(key) && theme.label && theme.tags.length + theme.words.length > 0, key);
    for (const word of theme.words) assert.ok(!/[\\%_,()."'{}*:]/.test(word), `${key}: ${word}`);
    const clause = themeClause(key);
    assert.equal(clause.split(",").length, theme.tags.length + theme.words.length, key);
    assert.ok(!/[()"']/.test(clause), clause);
  }
  assert.equal(isEventTheme("toString"), false);
});
