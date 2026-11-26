import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = (name) => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const countries = compile(await file("countries"));
const messages = compile(await file("i18n/messages"));
const i18n = compile((await file("i18n/index")).replace('"./messages"', JSON.stringify(messages)));
const events = compile((await file("events")).replace('"./countries"', JSON.stringify(countries)));
process.env.NEXT_PUBLIC_SITE_URL = "https://festiva.test";
process.env.VERCEL_ENV = "production";
const site = compile(await file("site"));
const { resolveSiteUrl } = await import(site);
let source = await file("seo");
for (const [name, value] of [["./i18n",i18n],["./site",site],["./countries",countries],["./events",events]]) source = source.replace(JSON.stringify(name), JSON.stringify(value));
const { pageMetadata, localizedPath, eventStructuredData, serializeJsonLd, collectionStructuredData, sitemapEntry, sitemapUrl, eventDescription } = await import(compile(source));
test("canonical language/event/page URLs stay distinct and share reciprocal alternates", () => {
  const metadata = pageMetadata({ title:"Events",description:"Explore",path:"/korea",locale:"en",values:{page:2} });
  assert.equal(metadata.alternates.canonical,"https://festiva.test/korea?page=2&lang=en");
  assert.equal(metadata.alternates.languages["zh-TW"],"https://festiva.test/korea?page=2&lang=zh-TW");
  assert.equal(metadata.robots.index,true);
  assert.equal(pageMetadata({title:"Search",description:"Search",path:"/korea",locale:"ko",noindex:true}).robots.index,false);
  assert.equal(localizedPath("/taiwan?event=abc","zh-TW"),"/taiwan?event=abc&lang=zh-TW");
});
test("structured event data is honest, stable and safe inside script tags", () => {
  const event={id:"e",title:"<script>title</script>",description:"Description",countryCode:"tw",address:"Taipei, Taiwan",venue:"City Hall",region:"Taipei",latitude:25,longitude:121,startDate:"2026-12-31",endDate:"2027-01-01",eventStatus:"scheduled",poster:"https://expired.example/?token=secret"};
  const data=eventStructuredData(event,"en");
  assert.equal(data.url,"https://festiva.test/taiwan?event=e&lang=en");
  assert.equal(data.image,"https://festiva.test/images/events/e");assert.equal(data.offers,undefined);assert.equal(data.organizer,undefined);
  assert.equal(eventStructuredData({...event,startDate:null},"en"),null);
  assert.equal(eventStructuredData({...event,address:""},"en"),null);
  assert.ok(!serializeJsonLd(data).includes("</script>")); assert.equal(JSON.parse(serializeJsonLd(data)).name,event.title);
  const list=collectionStructuredData("Events","/korea",[event],"en",2);
  assert.equal(list.mainEntity.itemListElement[0].position,25);assert.equal(list.mainEntity.itemListElement[0]["@type"],"ListItem");
});
test("production canonical origins never inherit preview hosts or localhost configuration", () => {
  assert.equal(resolveSiteUrl("http://localhost:3000","festiva.vercel.app"),"https://festiva.vercel.app");
  assert.equal(resolveSiteUrl("https://festiva.test/path?q=x","other.vercel.app"),"https://festiva.test");
  assert.equal(resolveSiteUrl("javascript:alert(1)"),"http://localhost:3000");
});
test("sitemap URLs are escaped for XML, once", () => {
  const entry = sitemapEntry("/korea", { event: "abc" });
  assert.equal(entry.url, "https://festiva.test/korea?event=abc&amp;lang=ko");
  assert.equal(entry.alternates.languages["zh-TW"], "https://festiva.test/korea?event=abc&amp;lang=zh-TW");
  assert.equal(entry.alternates.languages["x-default"], "https://festiva.test/korea?event=abc&amp;lang=ko");
  assert.equal(sitemapEntry("/").url, "https://festiva.test/?lang=ko");
  assert.equal(sitemapUrl("a?x=1&amp;y=2"), "a?x=1&amp;y=2");
  for (const value of [entry.url, ...Object.values(entry.alternates.languages)]) assert.ok(!/&(?!amp;)/.test(value), value);
});
test("titles get the brand unless they already name it", () => {
  assert.equal(pageMetadata({ title: "Festivals and local events in South Korea", description: "d", path: "/korea", locale: "en" }).title, "Festivals and local events in South Korea");
  assert.deepEqual(pageMetadata({ title: "festiva — 지도로 만나는 우리 동네 행사", description: "d", path: "/", locale: "ko" }).title, { absolute: "festiva — 지도로 만나는 우리 동네 행사" });
  assert.equal(pageMetadata({ title: "Festival Paris", description: "d", path: "/france", locale: "en" }).title, "Festival Paris");
});
test("event snippets lead with when and where, then the description, within 160 characters", () => {
  const event = { title: "러브액츄얼리", description: "관람료: 전석무료   문의: 054-955-3832", venue: "청주한국공예관", region: "충청북도", address: "충북 청주시", startDate: "2026-12-23", endDate: "2026-12-25" };
  assert.equal(eventDescription(event), "2026.12.23 — 2026.12.25 · 청주한국공예관 · 충청북도. 관람료: 전석무료 문의: 054-955-3832");
  assert.equal(eventDescription({ ...event, venue: "충청북도", endDate: "2026-12-23" }), "2026.12.23 · 충청북도. 관람료: 전석무료 문의: 054-955-3832");
  assert.equal(eventDescription({ ...event, startDate: null, venue: "", region: "", description: "" }), "충북 청주시");
  assert.equal(eventDescription({ title: "Only a title" }), "Only a title");
  const long = eventDescription({ ...event, description: "가".repeat(400) });
  assert.equal(Array.from(long).length, 160); assert.ok(long.endsWith("…"));
});
