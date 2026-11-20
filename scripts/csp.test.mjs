import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const { buildCsp, originOf } = await import(compile(await readFile(new URL("../src/lib/csp.ts", import.meta.url), "utf8")));

const directive = (csp, name) => {
  const found = csp.split("; ").find((part) => part.startsWith(`${name} `));
  assert.ok(found, `${name} missing`);
  return found.slice(name.length + 1).split(" ");
};

test("default tiles, public posters and the same-origin MapLibre worker are allowed", () => {
  const csp = buildCsp({ supabaseUrl: "https://abc.supabase.co" });
  const img = directive(csp, "img-src");
  for (const source of ["'self'", "data:", "blob:", "https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org", "https://abc.supabase.co", "https://tong.visitkorea.or.kr", "https://*.gov.tw", "https://*.taiwan.net.tw"]) assert.ok(img.includes(source), source);
  const connect = directive(csp, "connect-src");
  assert.deepEqual(connect, ["'self'", "https://abc.supabase.co", "https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org"]);
  assert.deepEqual(directive(csp, "worker-src"), ["'self'", "blob:"]);
  assert.deepEqual(directive(csp, "base-uri"), ["'self'"]);
  assert.deepEqual(directive(csp, "object-src"), ["'none'"]);
  assert.deepEqual(directive(csp, "frame-ancestors"), ["'none'"]);
});

test("server-only providers and form-action are not in the policy", () => {
  const csp = buildCsp({ supabaseUrl: "https://abc.supabase.co" });
  for (const host of ["api.anthropic.com", "api.geoapify.com", "nominatim.openstreetmap.org"]) assert.ok(!csp.includes(host), host);
  assert.ok(!csp.includes("form-action"));
});

test("MAP_TILE_URL origin is added to img-src and connect-src", () => {
  const csp = buildCsp({ supabaseUrl: "https://abc.supabase.co", mapTileUrl: " https://tiles.example.com:8443/{z}/{x}/{y}.png " });
  assert.ok(directive(csp, "img-src").includes("https://tiles.example.com:8443"));
  assert.ok(directive(csp, "connect-src").includes("https://tiles.example.com:8443"));
  assert.ok(!csp.includes("{z}"));
  // Non-https tile URLs are rejected by map-config and must not widen the CSP.
  assert.ok(!buildCsp({ mapTileUrl: "http://tiles.example.com/{z}/{x}/{y}.png" }).includes("tiles.example.com"));
  assert.ok(!buildCsp({ mapTileUrl: "not a url" }).includes("not"));
});

test("Supabase URL uses its exact origin, including local http URLs, with a wildcard fallback", () => {
  const local = buildCsp({ supabaseUrl: "http://127.0.0.1:54321" });
  assert.ok(directive(local, "connect-src").includes("http://127.0.0.1:54321"));
  assert.ok(directive(local, "img-src").includes("http://127.0.0.1:54321"));
  const fallback = buildCsp({});
  assert.ok(directive(fallback, "connect-src").includes("https://*.supabase.co"));
  assert.ok(directive(fallback, "img-src").includes("https://*.supabase.in"));
  assert.equal(originOf("https://abc.supabase.co/rest/v1"), "https://abc.supabase.co");
  assert.equal(originOf(""), null);
  assert.equal(originOf("javascript:alert(1)"), null);
});
