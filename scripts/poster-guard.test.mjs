import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const { checkPosterRequest, createRateLimiter, sameOriginRequest, MAX_POSTER_BODY_LENGTH } = await import(compile(await readFile(new URL("../src/lib/poster-guard.ts", import.meta.url), "utf8")));

const base = { bodyLength: 1000, origin: "https://festiva.test", host: "festiva.test", url: "http://localhost:3000/api/extract-poster", ip: "1.1.1.1" };
const allow = () => true;

test("oversize bodies are 413 before origin or rate checks run", () => {
  let called = false;
  const result = checkPosterRequest({ ...base, bodyLength: MAX_POSTER_BODY_LENGTH + 1, origin: "https://evil.test" }, () => { called = true; return true; });
  assert.deepEqual(result, { ok: false, status: 413 });
  assert.equal(called, false);
  assert.deepEqual(checkPosterRequest({ ...base, bodyLength: MAX_POSTER_BODY_LENGTH }, allow), { ok: true });
  assert.ok(MAX_POSTER_BODY_LENGTH < 4_500_000, "must stay under the Vercel 4.5MB body limit");
});

test("cross-site origins are 403 and do not consume rate budget", () => {
  let called = false;
  assert.deepEqual(checkPosterRequest({ ...base, origin: "https://evil.test" }, () => { called = true; return true; }), { ok: false, status: 403 });
  assert.equal(called, false);
  assert.equal(sameOriginRequest(null, "festiva.test", base.url), true);
  assert.equal(sameOriginRequest("not a url", "festiva.test", base.url), false);
  assert.equal(sameOriginRequest("http://localhost:3000", null, base.url), true);
});

test("per-IP limit is 5 per minute and resets after the window", () => {
  const take = createRateLimiter();
  for (let i = 0; i < 5; i++) assert.equal(take("1.1.1.1", 0), true);
  assert.equal(take("1.1.1.1", 0), false);
  assert.deepEqual(checkPosterRequest(base, (ip) => take(ip, 0)), { ok: false, status: 429 });
  assert.equal(take("2.2.2.2", 0), true);
  assert.equal(take("1.1.1.1", 60_000), true);
});

test("global limit of 30 per minute caps distributed callers", () => {
  const take = createRateLimiter();
  for (let i = 0; i < 30; i++) assert.equal(take(`10.0.0.${i}`, 0), true);
  assert.equal(take("10.0.1.1", 0), false);
  assert.equal(take("10.0.1.1", 60_001), true);
});
