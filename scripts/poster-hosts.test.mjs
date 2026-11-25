import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const { isResizablePoster } = await import(compile(await readFile(new URL("../src/lib/poster-hosts.ts", import.meta.url), "utf8")));

test("public poster hosts are resized", () => {
  for (const url of [
    "https://www.culture.go.kr/upload/rdf/26/11/a.jpg",
    "https://cdn.paris.fr/qfapv4/2026/09/16/huge-a.jpg",
    "https://www.sunmoonlake.gov.tw/fapi/Image?type=Activity&id=1",
    "https://data.gov.tw/a.png",
    "https://media.taiwan.net.tw/a.jpg",
    "/assets/posters/Event_A15010000H_081870.jpg",
  ]) assert.equal(isResizablePoster(url), true, url);
});

test("TourAPI, Supabase and anything else stay original", () => {
  for (const url of [
    "https://tong.visitkorea.or.kr/cms/resource/85/a.jpg", // KOGL Type 3: no alteration
    "https://abc.supabase.co/storage/v1/object/sign/event-posters/a.jpg?token=x",
    "http://www.culture.go.kr/a.jpg",
    "https://www.culture.go.kr:8443/a.jpg",
    "https://evilgov.tw/a.jpg",
    "https://gov.tw.evil.com/a.jpg",
    "https://culture.go.kr/a.jpg",
    "data:image/jpeg;base64,AAAA",
    "/assets/posters/../korea.json",
    "/assets/posters/Event_a.jpg?x=1",
    "/assets/korea.json",
    "//evil.com/assets/posters/Event_a.jpg",
    "",
    "not a url",
  ]) assert.equal(isResizablePoster(url), false, url);
});
