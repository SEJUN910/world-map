import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = (name) => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const source = (await file("event-search"))
  .replace('"./event-tags"', JSON.stringify(compile(await file("event-tags"))))
  .replace('"./event-categories"', JSON.stringify(compile(await file("event-categories"))))
  .replace('"./i18n/messages"', JSON.stringify(compile(await file("i18n/messages"))));
const { searchWords, searchClauses, searchesDescription, applySearch } = await import(compile(source));
const extra = (query) => searchClauses(query).map((clause) => clause.split(",").filter((part) => !/^(title|region|venue|address)\./.test(part)));

test("a tag label in any UI language finds the tag", () => {
  for (const query of ["뮤지컬", "musical", "Musical", "音樂劇"]) assert.ok(extra(query)[0].includes("tags.cs.{musical}"), query);
  assert.ok(extra("스트리트 아트")[0].includes("tags.cs.{street-art}"));
  assert.ok(extra("스트리트아트")[0].includes("tags.cs.{street-art}"));
  assert.ok(extra("contemporary art")[0].includes("tags.cs.{contemporary-art}"));
  assert.ok(extra("키즈")[0].includes("tags.cs.{kids}"));
});

test("categories match by label, except 기타 (the guitar)", () => {
  assert.ok(extra("공연")[0].includes("category.eq.performance"));
  assert.ok(extra("전시회")[0].includes("category.eq.exhibition"));
  assert.ok(!extra("기타")[0].some((part) => part.startsWith("category.")));
});

test("every word must match; multi-word labels stay one word", () => {
  assert.deepEqual(searchWords("서울 뮤지컬"), ["서울", "뮤지컬"]);
  assert.equal(searchClauses("서울 뮤지컬").length, 2);
  assert.deepEqual(searchWords("스트리트 아트 파리"), ["스트리트 아트", "파리"]);
  assert.equal(searchWords("a b c d e f").length, 4);
  const calls = [];
  const request = { or: (value) => (calls.push(value), request) };
  applySearch(request, "서울 뮤지컬");
  assert.equal(calls.length, 2);
  applySearch(request, "   ");
  assert.equal(calls.length, 2);
});

test("descriptions only for long-enough words; free finds gratuit", () => {
  assert.equal(searchesDescription("무료"), true);
  assert.equal(searchesDescription("전"), false);
  assert.equal(searchesDescription("art"), false);
  assert.equal(searchesDescription("jazz"), true);
  assert.deepEqual(extra("art")[0], []);
  assert.ok(extra("무료")[0].includes("description.ilike.%gratuit%"));
  assert.ok(extra("free")[0].includes("description.ilike.%무료%"));
});

test("filter grammar and wildcards never reach PostgREST", () => {
  for (const clause of searchClauses("a,b(c)%_ x.y:'z\" {q}*")) assert.doesNotMatch(clause.replace(/\.ilike\.%[^%]*%/g, "").replace(/tags\.cs\.\{[a-z-]+\}/g, ""), /[()%_"'{}*:]/);
  for (const word of searchWords("a,b(c)%_ x.y:'z\" {q}*")) assert.doesNotMatch(word, /[\\%_,()."'{}*:]/);
});

test("phrases need whole words and tolerate extra spaces; control characters are dropped", () => {
  assert.deepEqual(searchWords("downstreet artwork"), ["downstreet", "artwork"]);
  assert.deepEqual(searchWords("스트리트   아트"), ["스트리트 아트"]);
  assert.deepEqual(searchWords("a\u0000b\tc\u007f"), ["a", "b", "c"]);
});
