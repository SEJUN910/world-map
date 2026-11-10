import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, beforeEach } from "node:test";
import ts from "typescript";

// Exercise browser storage behavior without needing the unavailable UI host.
const source = await readFile(
  new URL("../src/lib/drafts.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { readDrafts, saveDraft, deleteDraft, preparePoster } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const data = new Map();
let rejectWrites = false;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (rejectWrites) throw new Error("Quota exceeded");
      data.set(key, value);
    },
  },
});
const storageKey = "festiva-event-drafts-v2";
const draft = (id) => ({
  id,
  slug: "draft",
  title: "동네 작은 행사",
  description: "동네 행사 안내",
  region: "서울",
  regionCode: "",
  venue: "동네 광장",
  address: "",
  latitude: 37.56,
  longitude: 126.98,
  poster: "data:image/jpeg;base64,AA==",
  startDate: null,
  endDate: null,
  officialUrl: "",
  updatedAt: "2026-11-04T00:00:00.000Z",
});
beforeEach(() => {
  data.clear();
  rejectWrites = false;
});

test("save, reload, edit and delete preserve unrelated drafts and legacy records", () => {
  data.set("festiva-korea-custom-v1", "legacy records");
  saveDraft(draft("a"));
  saveDraft(draft("b"));
  saveDraft({
    ...readDrafts().find((item) => item.id === "a"),
    title: "수정한 행사",
  });
  assert.equal(readDrafts().length, 2);
  assert.equal(
    readDrafts().find((item) => item.id === "a").title,
    "수정한 행사",
  );
  deleteDraft("a");
  assert.deepEqual(
    readDrafts().map((item) => item.id),
    ["b"],
  );
  assert.equal(data.get("festiva-korea-custom-v1"), "legacy records");
});
test("corrupt storage is reported instead of overwritten on save", () => {
  data.set(storageKey, "broken json");
  assert.throws(() => saveDraft(draft("a")));
  assert.equal(data.get(storageKey), "broken json");
});
test("failed writes retain previously saved drafts", () => {
  saveDraft(draft("a"));
  rejectWrites = true;
  assert.throws(() => saveDraft(draft("b")), /Quota/);
  assert.deepEqual(
    readDrafts().map((item) => item.id),
    ["a"],
  );
});
test("unsupported poster formats and oversize files are rejected before decoding", async () => {
  await assert.rejects(
    preparePoster({ type: "image/svg+xml", size: 100 }),
    /JPG/,
  );
  await assert.rejects(
    preparePoster({ type: "image/jpeg", size: 11 * 1024 * 1024 }),
    /10MB/,
  );
});

test("compressed poster transfer stays within the Vercel request budget", async () => {
  const previousBitmap = globalThis.createImageBitmap;
  const previousDocument = globalThis.document;
  let bytes = 3 * 1024 * 1024;
  let closed = 0;
  globalThis.createImageBitmap = async () => ({ width: 2000, height: 3000, close: () => closed++ });
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => `data:image/jpeg;base64,${Buffer.alloc(bytes).toString("base64")}` }) };
  try {
    assert.ok((await preparePoster({type:"image/jpeg",size:8*1024*1024})).startsWith("data:image/jpeg;base64,"));
    bytes++;
    await assert.rejects(preparePoster({type:"image/jpeg",size:8*1024*1024}));
    assert.equal(closed,2);
  } finally {
    globalThis.createImageBitmap = previousBitmap;
    globalThis.document = previousDocument;
  }
});
