import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = name => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const countries = compile(await file("countries"));
const events = compile((await file("events")).replace('"./countries"', JSON.stringify(countries)));
const { normalizeDiscoveryFilters, discoveryDateRange, parseBounds, discoveryParams, applyDiscoveryFilters } = await import(compile((await file("discovery-filters")).replace('"./events"', JSON.stringify(events))));
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
