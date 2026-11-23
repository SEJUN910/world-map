import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = name => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const countries = compile(await file("countries"));
const events = compile((await file("events")).replace('"./countries"', JSON.stringify(countries)));
const { eventShareUrl, eventHasEnded, SAVED_EVENTS_LIMIT } = await import(compile((await file("saved-events")).replace('"./countries"', JSON.stringify(countries)).replace('"./events"', JSON.stringify(events))));
const migration = await readFile(new URL("../supabase/migrations/202611230001_saved_events.sql", import.meta.url), "utf8");
const membersOnly = await readFile(new URL("../supabase/migrations/202611230002_saved_events_members_only.sql", import.meta.url), "utf8");
const id = "0b8f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4";

test("share links point at the country modal URL and keep the sharer's language", () => {
  assert.equal(eventShareUrl("https://festiva.example", { id, countryCode: "kr" }, "ko"), `https://festiva.example/korea?event=${id}&lang=ko`);
  assert.equal(eventShareUrl("https://festiva.example/", { id, countryCode: "tw" }, "zh-TW"), `https://festiva.example/taiwan?event=${id}&lang=zh-TW`);
  // Missing country falls back to Korea, like eventPath().
  assert.equal(eventShareUrl("http://127.0.0.1:3000", { id }, "en"), `http://127.0.0.1:3000/korea?event=${id}&lang=en`);
});

test("an event ends after its last day in its own country; undated events never end", () => {
  assert.equal(eventHasEnded({ startDate: "2026-11-01", endDate: "2026-11-22", countryCode: "kr" }, "2026-11-23"), true);
  assert.equal(eventHasEnded({ startDate: "2026-11-01", endDate: "2026-11-23", countryCode: "kr" }, "2026-11-23"), false);
  assert.equal(eventHasEnded({ startDate: "2026-11-22", endDate: null, countryCode: "tw" }, "2026-11-23"), true);
  assert.equal(eventHasEnded({ startDate: "2026-11-24", endDate: null, countryCode: "tw" }, "2026-11-23"), false);
  assert.equal(eventHasEnded({ startDate: null, endDate: null }, "2026-11-23"), false);
});

test("the app limit matches the database trigger; saving is for members only", () => {
  assert.equal(SAVED_EVENTS_LIMIT, 200);
  assert.match(migration, />= 200 then/);
  assert.match(membersOnly, /'is_anonymous'\)::boolean, false\) = false/);
  // The handoff no longer touches saved events once guests cannot save.
  assert.doesNotMatch(membersOnly.slice(membersOnly.indexOf("create or replace function")), /saved_events/);
});
