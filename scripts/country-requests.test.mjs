import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = (name) => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const countries = compile(await file("countries"));
const { REQUESTABLE_COUNTRIES, isRequestableCountry, searchRequestableCountries, countryName } = await import(compile((await file("requestable-countries")).replace('"./countries"', JSON.stringify(countries))));

test("supported countries cannot be requested; other ISO codes can", () => {
  for (const code of ["KR", "TW", "FR"]) { assert.equal(REQUESTABLE_COUNTRIES.includes(code), false, code); assert.equal(isRequestableCountry(code), false); }
  for (const code of ["JP", "SG", "TH", "US", "VN"]) assert.equal(isRequestableCountry(code), true, code);
  for (const value of ["jp", "JPN", "", "XX", null, 81, ["JP"], "__proto__"]) assert.equal(isRequestableCountry(value), false, String(value));
  assert.equal(new Set(REQUESTABLE_COUNTRIES).size, REQUESTABLE_COUNTRIES.length);
  assert.ok(REQUESTABLE_COUNTRIES.length > 240);
});

test("search matches the UI-language name, the English name and the exact ISO code", () => {
  const codes = (query, locale) => searchRequestableCountries(query, locale).map((item) => item.code);
  assert.ok(codes("일본", "ko").includes("JP"));
  assert.ok(codes("japan", "ko").includes("JP"));
  assert.ok(codes("JP", "en").includes("JP"));
  assert.ok(codes("日本", "zh-TW").includes("JP"));
  assert.ok(codes("일본", "en").includes("JP"), "Korean name works in the English UI");
  assert.deepEqual(codes("jp", "ko").slice(0, 1).length, 1);
  assert.equal(codes("", "ko").length, REQUESTABLE_COUNTRIES.length);
  assert.equal(codes("zzzz", "ko").length, 0);
  assert.equal(countryName("JP", "ko"), "일본");
  assert.equal(countryName("JP", "en"), "Japan");
});
