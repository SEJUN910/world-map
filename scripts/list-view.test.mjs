import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = name => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const countries = compile(await file("countries"));
const eventsUrl = compile((await file("events")).replace('"./countries"', JSON.stringify(countries)));
const { eventBadge } = await import(eventsUrl);
const { normalizeSort, normalizeView, viewParams } = await import(compile((await file("discovery-filters")).replace('"./event-categories"', JSON.stringify(compile(await file("event-categories")))).replace('"./events"', JSON.stringify(eventsUrl))));
const badge = (startDate, endDate, eventStatus = "scheduled") => {
  const result = eventBadge({ startDate, endDate, eventStatus }, "2026-11-23");
  return result && (result.values ? result.label.replace("{days}", result.values.days) : result.label);
};

test("progress badges follow the event's dates in its own country", () => {
  assert.equal(badge("2026-11-01", "2026-12-31"), "진행 중");
  assert.equal(badge("2026-11-01", "2026-11-26"), "종료 임박");
  assert.equal(badge("2026-11-01", "2026-11-27"), "진행 중");
  assert.equal(badge("2026-11-20", "2026-11-23"), "오늘 종료");
  assert.equal(badge("2026-11-23", null), "오늘 종료");
  assert.equal(badge("2026-11-24", "2026-11-30"), "D-1");
  assert.equal(badge("2026-12-07", null), "D-14");
  assert.equal(badge("2026-12-08", null), "예정");
  assert.equal(badge("2026-11-01", "2026-11-22"), "종료");
  assert.equal(badge("2026-11-22", null), "종료");
  assert.equal(badge(null, null), null);
  // A cancelled or postponed event says so whatever its dates are.
  assert.equal(badge("2026-11-01", "2026-12-31", "cancelled"), "취소됨");
  assert.equal(badge(null, null, "postponed"), "연기됨");
  // Month and year boundaries count calendar days, not 24h windows.
  assert.equal(eventBadge({ startDate: "2027-01-02", endDate: null }, "2026-12-31").values.days, 2);
});

test("view and sort accept only known values and stay out of URLs by default", () => {
  assert.equal(normalizeView("list"), "list");
  for (const value of [undefined, "", "map", "LIST", "foo", ["list"]]) assert.equal(normalizeView(value), "map");
  assert.equal(normalizeSort("soon"), "soon");
  assert.equal(normalizeSort("ending"), "ending");
  for (const value of [undefined, "", "latest", "nearest", "Soon"]) assert.equal(normalizeSort(value), "latest");
  assert.deepEqual(viewParams("map", "latest"), {});
  assert.deepEqual(viewParams("list", "latest"), { view: "list" });
  assert.deepEqual(viewParams("map", "ending"), { sort: "ending" });
  assert.deepEqual(viewParams("list", "soon"), { view: "list", sort: "soon" });
});
