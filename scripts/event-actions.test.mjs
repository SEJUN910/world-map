import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const { directionsLinks, calendarPlan, googleCalendarUrl, icsFile, addDays } = await import(compile(await readFile(new URL("../src/lib/event-actions.ts", import.meta.url), "utf8")));

const seoul = { title: "공연", venue: "예술의전당 1관/소극장, 별관", address: "서울 서초구", latitude: 37.4786123456, longitude: 127.0119, countryCode: "kr" };

test("Korea gets Naver, Kakao and Google (Korean UI first), elsewhere Google only", () => {
  assert.deepEqual(directionsLinks(seoul, "ko").map((l) => l.service), ["naver", "kakao", "google"]);
  assert.deepEqual(directionsLinks(seoul, "en").map((l) => l.service), ["google", "naver", "kakao"]);
  assert.deepEqual(directionsLinks({ ...seoul, countryCode: "fr" }, "ko").map((l) => l.service), ["google"]);
  assert.deepEqual(directionsLinks({ ...seoul, latitude: NaN }, "ko"), []);
});

test("links carry exact coordinates and a path-safe place name", () => {
  const [naver, kakao, google] = directionsLinks(seoul, "ko");
  assert.equal(google.href, "https://www.google.com/maps/dir/?api=1&destination=37.478612,127.0119");
  assert.match(kakao.href, /^https:\/\/map\.kakao\.com\/link\/to\/[^/,]+,37\.478612,127\.0119$/);
  assert.equal(decodeURIComponent(kakao.href.split("/to/")[1].split(",")[0]), "예술의전당 1관 소극장 별관");
  assert.match(naver.href, /^https:\/\/map\.naver\.com\/p\/directions\/-\/127\.0119,37\.478612,[^/,]+,,\/-\/transit$/);
});

test("calendar plan: none, short range from today, or a picked day for long events", () => {
  const today = "2026-11-25";
  assert.deepEqual(calendarPlan({ startDate: null, endDate: null }, today), { kind: "none" });
  assert.deepEqual(calendarPlan({ startDate: "2026-11-01", endDate: "2026-11-20" }, today), { kind: "none" });
  assert.deepEqual(calendarPlan({ startDate: "2026-12-05", endDate: "2026-12-07", eventStatus: "cancelled" }, today), { kind: "none" });
  assert.deepEqual(calendarPlan({ startDate: "2026-12-05", endDate: null }, today), { kind: "range", start: "2026-12-05", end: "2026-12-05" });
  assert.deepEqual(calendarPlan({ startDate: "2026-12-05", endDate: "2026-12-11" }, today), { kind: "range", start: "2026-12-05", end: "2026-12-11" });
  assert.deepEqual(calendarPlan({ startDate: "2026-11-20", endDate: "2026-11-28" }, today), { kind: "range", start: "2026-11-25", end: "2026-11-28" });
  assert.deepEqual(calendarPlan({ startDate: "2026-12-05", endDate: "2026-12-12" }, today), { kind: "pick", min: "2026-12-05", max: "2026-12-12" });
  assert.deepEqual(calendarPlan({ startDate: "2026-10-01", endDate: "2027-03-01" }, today), { kind: "pick", min: "2026-11-25", max: "2027-03-01" });
});

test("all-day dates with an exclusive end, across month and year ends", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  const url = new URL(googleCalendarUrl({ ...seoul, id: "x" }, "2026-12-05", "2026-12-07", "d"));
  assert.equal(url.searchParams.get("dates"), "20261205/20261208");
  assert.equal(url.searchParams.get("ctz"), null);
});

test(".ics follows RFC 5545: CRLF, escaping, all-day dates, 75-octet folding", () => {
  const long = { ...seoul, id: "11111111-2222-3333-4444-555555555555", title: "아주 긴 행사 이름; 쉼표, 그리고 역슬래시\\ ".repeat(4) };
  const ics = icsFile(long, "2026-12-05", "2026-12-05", "일정: 2026.12.05\nhttps://x", "https://x", new Date("2026-11-25T01:02:03.456Z"));
  assert.ok(ics.endsWith("\r\n"));
  assert.doesNotMatch(ics.replace(/\r\n/g, ""), /\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261205\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261206\r\n/);
  assert.match(ics, /DTSTAMP:20261125T010203Z\r\n/);
  assert.match(ics, /UID:11111111-2222-3333-4444-555555555555-20261205@festiva/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("SUMMARY:아주 긴 행사 이름\\; 쉼표\\, 그리고 역슬래시\\\\ "));
  assert.ok(unfolded.includes("DESCRIPTION:일정: 2026.12.05\\nhttps://x"));
  assert.ok(unfolded.includes("GEO:37.478612;127.0119"));
});

test("malformed dates and stray carriage returns are handled", () => {
  assert.deepEqual(calendarPlan({ startDate: "2026-13-45x", endDate: null }, "2026-11-25"), { kind: "none" });
  const ics = icsFile({ ...seoul, id: "x", title: "a\rb\u0001c" }, "2026-12-05", "2026-12-05", "d", "https://x");
  assert.ok(ics.includes("SUMMARY:a\\nbc\r\n"));
});
