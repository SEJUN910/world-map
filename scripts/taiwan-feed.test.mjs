import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignText, classifyTaiwanEvent, duplicateKey, taiwanDates, taiwanDay, taiwanRegion, TAIWAN_IMAGE_HOST } from "./taiwan-feed-lib.mjs";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const { isResizablePoster } = await import(compile(await readFile(new URL("../src/lib/poster-hosts.ts", import.meta.url), "utf8")));

test("feed timestamps: only the UTC-midnight pair (16:00 → 15:59:59) is shifted", () => {
  assert.deepEqual(taiwanDates("2026-11-06T00:00:00+08:00", "2026-11-22T23:59:59+08:00"), { startDate: "2026-11-06", endDate: "2026-11-22" });
  assert.deepEqual(taiwanDates("2025-10-04T16:00:00+08:00", "2026-03-01T15:59:59+08:00"), { startDate: "2025-10-05", endDate: "2026-03-01" });
  assert.deepEqual(taiwanDates("2026-12-31T16:00:00+08:00", "2027-01-01T15:59:59+08:00"), { startDate: "2027-01-01", endDate: "2027-01-01" });
  // A real 4 pm start (concert, one-evening fair) keeps its day.
  assert.deepEqual(taiwanDates("2027-08-20T16:00:00+08:00", "2027-08-22T22:00:00+08:00"), { startDate: "2027-08-20", endDate: "2027-08-22" });
  assert.deepEqual(taiwanDates("2026-08-29T16:00:00+08:00", "2026-08-29T20:00:00+08:00"), { startDate: "2026-08-29", endDate: "2026-08-29" });
  assert.equal(taiwanDates("", "2026-11-22T23:59:59+08:00"), null);
  assert.equal(taiwanDates("2026-11-06T00:00:00+08:00", null), null);
  assert.equal(taiwanDay("2026-08-10T02:07:37+08:00"), "2026-08-10");
  assert.equal(taiwanDay(null), null);
});

test("descriptions that show a lottery, stamp campaign or notice", () => {
  assert.equal(campaignText("消費登錄發票即可參加摸彩，大獎等你拿"), true);
  assert.equal(campaignText("完成集章即可兌換好禮"), true);
  assert.equal(campaignText("金門老兵召集令活動公告"), true);
  assert.equal(campaignText("《金門島嶼生活節》10月盛大登場！"), false);
  assert.equal(campaignText(null), false);
});

test("cities map to the codes the curated entries use", () => {
  assert.deepEqual(taiwanRegion("臺北市"), { region: "Taipei", code: "tw-taipei" });
  assert.deepEqual(taiwanRegion("台東縣"), { region: "Taitung", code: "tw-taitung" });
  assert.deepEqual(taiwanRegion("新北市"), { region: "New Taipei", code: "tw-new-taipei" });
  assert.deepEqual(taiwanRegion("嘉義市"), { region: "Chiayi City", code: "tw-chiayi-city" });
  assert.equal(taiwanRegion("東京都"), null);
  assert.equal(taiwanRegion(undefined), null);
});

test("notices, apps, campaigns and classes are not events", () => {
  for (const title of ["活動交通管制公告", "尋找風獅爺APP", "「115年閱讀高手獎好禮」集點活動", "手作課程體驗", "國旅補助 台中加碼", "住台中抽好禮", "四極點集章"]) {
    assert.equal(classifyTaiwanEvent(title, "2026-12-01", "2026-12-02").keep, false, title);
  }
  assert.equal(classifyTaiwanEvent("2026阿里山四季茶旅活動", "2026-01-01", "2026-12-31").keep, false);
  assert.equal(classifyTaiwanEvent("壞日期", "2026-12-02", "2026-12-01").keep, false);
  for (const title of ["2026臺南購物節", "2026天光威購節", "2027望安主題特色遊程", "2026映像節(預計為11-12月辦理)"]) {
    assert.equal(classifyTaiwanEvent(title, "2026-12-01", "2026-12-02").keep, false, title);
  }
  // "APP" only as a word: "Happy" and "Apple" titles are events.
  assert.equal(classifyTaiwanEvent("HAPPY聖誕市集", "2026-12-01", "2026-12-02").keep, true);
  assert.equal(classifyTaiwanEvent("Happy New Year 跨年", "2026-12-31", "2027-01-01").keep, true);
});

test("categories and tags from Chinese titles", () => {
  const kind = (title) => { const result = classifyTaiwanEvent(title, "2026-12-01", "2026-12-10"); return [result.category, result.tags]; };
  assert.deepEqual(kind("2027澎大海沙灘音樂祭"), ["festival", ["concert", "festival"]]);
  assert.deepEqual(kind("2026台南聖誕燈節"), ["festival", ["night", "festival"]]);
  assert.deepEqual(kind("2026新北歡樂耶誕城"), ["festival", ["night", "festival"]]);
  assert.deepEqual(kind("2026臺灣國際陶藝雙年展"), ["exhibition", ["exhibition"]]);
  assert.deepEqual(kind("碧潭地景裝置展-遇見小王子"), ["exhibition", ["exhibition"]]);
  assert.deepEqual(kind("2026臺灣舞蹈平台"), ["performance", ["dance"]]);
  assert.deepEqual(kind("115年收冬戲"), ["performance", ["theater"]]);
  assert.deepEqual(kind("2026臺北馬拉松"), ["other", ["sport"]]);
  assert.deepEqual(kind("浦揪新創市集"), ["other", ["flea-market"]]);
  // "發展" is not an exhibition.
  assert.equal(kind("地方發展論壇活動")[0], "other");
});

test("the same event from two agencies shares a key; the year does not matter", () => {
  assert.equal(duplicateKey("2026花蓮鯉魚潭水岸光影節", "tw-hualien"), duplicateKey("2026 花蓮鯉魚潭水岸光影節", "tw-hualien"));
  assert.equal(duplicateKey("2026-2027茂林雙年賞蝶季", "tw-kaohsiung"), duplicateKey("茂林雙年賞蝶季", "tw-kaohsiung"));
  assert.notEqual(duplicateKey("山谷燈光節", "tw-chiayi-county"), duplicateKey("山谷燈光節", "tw-yilan"));
  assert.equal(duplicateKey("台灣國際觀鳥馬拉松", "tw-tainan"), duplicateKey("2026臺灣國際觀鳥馬拉松", "tw-tainan"));
});

test("image hosts: the feed list, the optimizer list and the blocked host agree", () => {
  for (const url of ["https://www.taiwan.net.tw/att/event/a.jpg", "https://travel.yilan.gov.tw/x/1.jpg", "https://kinmen.travel/image/1/640x480", "https://hualien.travel/a.jpg", "https://newtaipei.travel/image/1/640x480", "https://www.twtainan.net/image/1/640x480", "https://www.ali-nsa.net/image/1/640x480"]) {
    assert.ok(TAIWAN_IMAGE_HOST.test(url), url);
    assert.ok(isResizablePoster(url), url);
  }
  for (const url of ["https://khh.travel/image/1/640x480", "https://images.plurk.com/a.png", "http://kinmen.travel/a.jpg", "https://evilkinmen.travel/a.jpg", "https://kinmen.travel.evil.com/a.jpg", "https://taiwan.net.tw/a.jpg", "https://gov.tw/a.jpg"]) {
    assert.equal(TAIWAN_IMAGE_HOST.test(url), false, url);
  }
});
