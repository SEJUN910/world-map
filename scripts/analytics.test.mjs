import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const pathModule = compile(await readFile(new URL("../src/lib/analytics-path.ts", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/lib/analytics.ts", import.meta.url), "utf8");
const { analyticsInput, analyticsPath, isLocalHost } = await import(compile(source.replace('"./analytics-path"', JSON.stringify(pathModule)).replace('"zod"', JSON.stringify(pathToFileURL(require.resolve("zod")).href))));
const { publicTraffic } = await import(compile(await readFile(new URL("../src/lib/traffic.ts", import.meta.url), "utf8")));

test("public traffic exposes only three valid counters, preserving genuine zero totals", () => {
  assert.deepEqual(publicTraffic({todayVisitors:0,pageViews:0,eventViews:0,visitor_hash:"private",referrers:[]}),{todayVisitors:0,pageViews:0,eventViews:0});
  for (const value of [null, {}, {todayVisitors:-1,pageViews:0,eventViews:0}, {todayVisitors:1,pageViews:"2",eventViews:0}, {todayVisitors:1,pageViews:2,eventViews:NaN}]) assert.equal(publicTraffic(value),null);
});
test("analytics allowlists public routes and bounded non-sensitive payloads", () => {
  assert.equal(analyticsPath("/admin/analytics"), null); assert.equal(analyticsPath("/me/events"), null);
  assert.equal(analyticsPath("/regions/taipei"), "/regions");
  assert.equal(isLocalHost("127.0.0.1:3011"), true); assert.equal(isLocalHost("localhost.evil.com"), false);
  const valid = { id: crypto.randomUUID(), kind: "page_view", eventId: null, path: "/taiwan", country: "tw", locale: "en", referrer: "example.com" };
  assert.equal(analyticsInput.safeParse(valid).success, true);
  for (const override of [{ eventId: crypto.randomUUID() }, { kind: "event_view" }, { path: "/admin" }, { locale: "x" }, { referrer: "https://example.com/?secret=x" }, { userIp: "127.0.0.1" }]) assert.equal(analyticsInput.safeParse({ ...valid, ...override }).success, false);
});
test("client avoids refresh/language/reopen inflation and honors tracking opt-out", async () => {
  const calls = [];
  Object.defineProperty(globalThis, "navigator", { value: { doNotTrack: "0" }, configurable: true });
  globalThis.document = { visibilityState: "visible", referrer: "https://example.com/private?q=secret" };
  globalThis.location = { pathname: "/taiwan", host: "festiva.test" };
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: true }; };
  const source = await readFile(new URL("../src/lib/analytics-client.ts", import.meta.url), "utf8");
  const { sendAnalytics, leaveAnalyticsPage } = await import(compile(source.replace('"./analytics-path"', JSON.stringify(pathModule))));
  sendAnalytics("page_view", "ko"); sendAnalytics("page_view", "en");
  const id = crypto.randomUUID(); sendAnalytics("event_view", "en", id); sendAnalytics("event_view", "zh-TW", id);
  await new Promise(setImmediate);
  assert.equal(calls.length, 2); assert.equal(calls[0].referrer, "example.com"); assert.equal(calls[1].eventId, id);
  leaveAnalyticsPage(); sendAnalytics("page_view", "en"); await new Promise(setImmediate); assert.equal(calls.length, 3);
  navigator.doNotTrack = "1"; leaveAnalyticsPage(); sendAnalytics("page_view", "en"); await new Promise(setImmediate); assert.equal(calls.length, 3);
});
