import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const file = (name) => readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const nearby = await import(compile((await file("nearby")).replace('"./countries"', JSON.stringify(compile(await file("countries"))))));
const { distanceMeters, nearbyEvents, zoomForAccuracy, formatDistance, countryAt, accuracyCircle, handOffPosition, takeHandedOffPosition } = nearby;

const cityHall = { latitude: 37.5663, longitude: 126.9779 };

test("distances are great-circle meters", () => {
  // Seoul City Hall → Gangnam Station is about 8.9 km.
  const meters = distanceMeters(cityHall, { latitude: 37.4979, longitude: 127.0276 });
  assert.ok(meters > 8500 && meters < 9300, String(meters));
  assert.equal(Math.round(distanceMeters(cityHall, cityHall)), 0);
});

test("radius widens 10 → 30 → 50 km and sorts nearest first", () => {
  const point = (id, km) => ({ id, latitude: cityHall.latitude + km / 111.2, longitude: cityHall.longitude });
  let result = nearbyEvents([point("far", 9), point("near", 1), point("out", 20)], cityHall);
  assert.equal(result.radiusKm, 10);
  assert.deepEqual(result.items.map((item) => item.id), ["near", "far"]);
  result = nearbyEvents([point("a", 25), point("b", 45)], cityHall);
  assert.equal(result.radiusKm, 30);
  assert.deepEqual(result.items.map((item) => item.id), ["a"]);
  result = nearbyEvents([point("b", 45)], cityHall);
  assert.equal(result.radiusKm, 50);
  result = nearbyEvents([point("c", 80), { id: "bad", latitude: NaN, longitude: 1 }], cityHall);
  assert.deepEqual([result.radiusKm, result.items.length], [50, 0]);
});

test("zoom, labels, country and circle", () => {
  assert.deepEqual([zoomForAccuracy(20), zoomForAccuracy(1500), zoomForAccuracy(20000)], [12.5, 11, 10]);
  assert.deepEqual([formatDistance(3), formatDistance(846), formatDistance(2440), formatDistance(12_600)], ["10m", "850m", "2.4km", "13km"]);
  assert.equal(countryAt(cityHall), "kr");
  assert.equal(countryAt({ latitude: 48.8566, longitude: 2.3522 }), "fr");
  assert.equal(countryAt({ latitude: 25.03, longitude: 121.56 }), "tw");
  assert.equal(countryAt({ latitude: 35.68, longitude: 139.69 }), null);
  assert.equal(accuracyCircle({ ...cityHall, accuracy: 10 }), null);
  assert.equal(accuracyCircle({ ...cityHall, accuracy: 50_000 }), null);
  const ring = accuracyCircle({ ...cityHall, accuracy: 500 }).geometry.coordinates[0];
  assert.equal(ring.length, 49);
  assert.deepEqual(ring[0], ring[48]);
  for (const [lng, lat] of ring) { const d = distanceMeters(cityHall, { latitude: lat, longitude: lng }); assert.ok(Math.abs(d - 500) < 5, String(d)); }
});

test("the position is handed over once and expires", () => {
  handOffPosition({ ...cityHall, accuracy: 20 }, 1000);
  assert.deepEqual(takeHandedOffPosition(2000), { ...cityHall, accuracy: 20 });
  assert.equal(takeHandedOffPosition(2000), null);
  handOffPosition({ ...cityHall, accuracy: 20 }, 1000);
  assert.equal(takeHandedOffPosition(20_000), null);
});

test("security headers allow geolocation for this site only", async () => {
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /Permissions-Policy", value: "camera=\(\), microphone=\(\), geolocation=\(self\)"/);
});
