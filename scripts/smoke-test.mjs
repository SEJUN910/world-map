import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3000";
for (const path of [
  "/",
  "/korea",
  "/me/events",
  "/me/local-drafts",
  "/robots.txt",
  "/sitemap.xml",
  "/assets/world.json",
  "/assets/korea.json",
]) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, `${path} should return 200`);
  console.log(`PASS ${path}`);
}
for (const path of [
  "/events/new",
  "/me/events/example-draft",
  "/admin",
  "/admin/analytics",
  "/login",
  "/events/missing/unknown",
  "/regions/unknown",
])
  assert.equal((await fetch(`${origin}${path}`)).status, 404);
const privatePage = await (await fetch(`${origin}/me/events`)).text();
assert.match(privatePage, /name="robots" content="noindex/);
const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
assert.doesNotMatch(sitemap, /\/me\/|\/login|\/events\/new/);
console.log(
  "PASS no-signup routes, private noindex, 404 and public-only sitemap",
);
