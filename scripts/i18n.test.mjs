import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const messagesUrl = compile(await readFile(new URL("../src/lib/i18n/messages.ts", import.meta.url), "utf8"));
const { messages } = await import(messagesUrl);
const source = await readFile(new URL("../src/lib/i18n/index.ts", import.meta.url), "utf8");
const { translate, isLocale } = await import(compile(source.replace('"./messages"', JSON.stringify(messagesUrl))));
test("all UI translations have unique source keys, complete values and matching placeholders", () => {
  assert.equal(new Set(messages.map(([key]) => key)).size, messages.length);
  for (const row of messages) {
    const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const value of row) { assert.ok(value.trim()); assert.deepEqual(placeholders(value), placeholders(row[0]), row[0]); }
  }
});
test("language switching handles counts, saved notices and untouched event content", () => {
  assert.equal(translate("en", "{count}개 행사", { count: 12 }), "12 events");
  assert.equal(translate("zh-TW", "{count}개 행사", { count: 12 }), "12 個活動");
  assert.equal(translate("en", "행사 올리기"), "Add an event");
  assert.equal(translate("ko", "Saved privately."), "비공개로 저장했어요.");
  assert.equal(translate("zh-TW", "Saved privately."), "已儲存為私人活動。");
  assert.equal(translate("en", "이웃의 작은 음악회"), "이웃의 작은 음악회");
  assert.equal(isLocale("zh-TW"), true); assert.equal(isLocale("invalid"), false);
});
