// Explicit live test against a development project. Creates only synthetic
// accounts/fixtures and removes them in finally. Never sends authentication mail.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { encodeReply } from "next/dist/compiled/react-server-dom-webpack/client.node.js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_TEST_SERVICE_KEY;
const project = process.env.SUPABASE_TEST_PROJECT_REF;
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3000";
assert(
  service && project && new URL(url).hostname === `${project}.supabase.co`,
  "Set explicit development test project and service credential",
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, options);
const anon = createClient(url, key, options);
const manifest = JSON.parse(
  await readFile(".next/server/server-reference-manifest.json", "utf8"),
);
const actionIds = new Map(
  Object.entries(manifest.node).map(([id, entry]) => [entry.exportedName, id]),
);
const users = [],
  eventIds = [],
  paths = [];
const image = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=",
  "base64",
);
function ok(result, label) {
  assert.equal(
    result.error,
    null,
    `${label}: ${result.error?.code || result.error?.message || ""}`,
  );
  return result.data;
}
function pass(label) {
  console.log(`PASS ${label}`);
}
async function visitor(cookie = "", role) {
  const jar = new Map(
    cookie
      .split("; ")
      .filter(Boolean)
      .map((value) => {
        const i = value.indexOf("=");
        return [value.slice(0, i), value.slice(i + 1)];
      }),
  );
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const result = cookie
    ? await client.auth.getUser()
    : await client.auth.signInAnonymously();
  const { user } = ok(result, "Anonymous visitor session");
  assert(user.is_anonymous);
  users.push(user.id);
  if (role) {
    ok(
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { role },
      }),
      "Fixture moderator role",
    );
    ok(await client.auth.refreshSession(), "Refresh fixture moderator claims");
  }
  return {
    id: user.id,
    client,
    cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}
async function action(name, args, route, cookie = "") {
  const body = await encodeReply(args);
  const headers = {
    "Next-Action": actionIds.get(name),
    Origin: origin,
    Cookie: cookie,
  };
  if (typeof body === "string")
    headers["Content-Type"] = "text/plain;charset=UTF-8";
  const response = await fetch(`${origin}${route}`, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });
  const text = await response.text();
  assert.equal(
    response.status,
    200,
    `${name} HTTP response: ${response.status}`,
  );
  let result;
  for (const line of text.split("\n")) {
    if (!/^[0-9a-f]+:\{/.test(line)) continue;
    try {
      const value = JSON.parse(line.slice(line.indexOf(":") + 1));
      if (
        value.id ||
        value.error ||
        value.next ||
        value.success ||
        value.message
      )
        result = value;
    } catch {}
  }
  assert(result, `${name} returned an unexpected action response`);
  return {
    result,
    cookie:
      response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ") || cookie,
  };
}
function form(id, title, publication = "draft", withImage = true) {
  const data = new FormData();
  const fields = {
    id,
    title,
    description: "자동 검증용 행사입니다.",
    region: "테스트 지역",
    venue: "테스트 광장",
    address: "테스트 주소",
    latitude: "37.56",
    longitude: "126.98",
    startDate: "2027-03-01",
    endDate: "2027-03-02",
    officialUrl: "https://example.com/",
    publicationStatus: publication,
  };
  Object.entries(fields).forEach(([name, value]) => data.set(name, value));
  if (withImage)
    data.set("poster", new File([image], "poster.jpg", { type: "image/jpeg" }));
  return data;
}
try {
  const stranger = await visitor(),
    moderator = await visitor("", "admin");
  const strangerLogin = { cookie: stranger.cookie };
  const id = crypto.randomUUID();
  eventIds.push(id);
  const invalid = form(id, "잘못된 날짜");
  invalid.set("endDate", "2020-01-01");
  assert(
    (await action("saveEventAction", [invalid], "/")).result.error,
  );
  const saved = await action(
    "saveEventAction",
    [form(id, "FESTIVA 자동검증 초안")],
    "/",
  );
  assert(saved.cookie.includes("sb-"));
  const owner = await visitor(saved.cookie);
  const ownerCookie = saved.cookie;
  const publicDataEvent = ok(
    await anon.from("events").select("id,title").eq("source_name", "tourapi").limit(1),
    "Read an imported event",
  )[0];
  if (publicDataEvent) {
    const attempted = ok(
      await owner.client.from("events").update({ title: "FESTIVA unauthorized edit" }).eq("id", publicDataEvent.id).select("id"),
      "Attempt foreign public event update",
    );
    assert.equal(attempted.length, 0, "Visitors cannot modify imported events");
  }
  const fakeId = crypto.randomUUID();
  eventIds.push(fakeId);
  const fake = {
    id: fakeId, author_id: null, title: "FESTIVA fake source fixture", slug: "fake-source",
    region: "테스트", region_code: "테스트", venue: "테스트", latitude: 37.5, longitude: 127,
    publication_status: "published", source_name: "national_cultural_festivals", source_id: "a".repeat(64),
    source_url: "https://www.data.go.kr/data/15013104/standard.do", source_provider: "test", source_synced_at: new Date().toISOString(),
  };
  assert((await owner.client.from("events").insert(fake)).error, "Visitor cannot forge an imported event");
  assert((await owner.client.from("events").update({ source_name: fake.source_name, source_id: fake.source_id }).eq("id", id)).error, "Visitor cannot label their event as imported");
  const fakeTour = { ...fake, source_name: "tourapi", source_id: "1234567890",
    source_url: "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578",
    source_provider: "한국관광공사", source_image_url: "https://tong.visitkorea.or.kr/test.jpg", source_image_license: "Type3" };
  assert((await owner.client.from("events").insert(fakeTour)).error, "Visitor cannot forge TourAPI records");
  assert((await admin.from("events").insert({ ...fakeTour, source_image_url: null })).error, "TourAPI records require an image");
  assert((await admin.from("events").insert({ ...fakeTour, source_image_url: "https://example.com/test.jpg" })).error, "TourAPI image must use the official host");
  pass("public source records cannot be forged or modified by visitors");
  const expiredId = crypto.randomUUID();
  eventIds.push(expiredId);
  ok(await admin.from("events").insert({
    ...fake, id: expiredId, source_id: crypto.randomUUID().replaceAll("-", "").repeat(2),
    title: "FESTIVA expired source fixture", slug: "expired-source",
    region: "FESTIVA-EXPIRED-REGION", region_code: "festiva-expired-region",
    start_date: "2020-01-01", end_date: "2020-01-02",
  }), "Insert expired source fixture");
  const expiredSearch = await fetch(`${origin}/korea?q=${encodeURIComponent("FESTIVA expired source fixture")}`);
  assert(!(await expiredSearch.text()).includes(expiredId), "Expired event must not appear in results");
  assert(!(await (await fetch(`${origin}/sitemap.xml`)).text()).includes(expiredId));
  assert.equal(ok(await anon.from("event_regions").select("code").eq("code", "festiva-expired-region"), "Read expired region").length, 0);
  pass("past imported events are excluded from search, regions and sitemap");
  assert.equal(saved.result.id, id);
  const owned = ok(
    await owner.client
      .from("events")
      .select("*, event_images(storage_path)")
      .eq("id", id)
      .single(),
    "Read own draft",
  );
  const imageRow = Array.isArray(owned.event_images)
    ? owned.event_images[0]
    : owned.event_images;
  const path = imageRow.storage_path;
  paths.push(path);
  assert.equal(owned.publication_status, "draft");
  assert.equal(
    ok(await anon.from("events").select("id").eq("id", id), "Anon draft query")
      .length,
    0,
  );
  assert.equal(
    ok(
      await stranger.client.from("events").select("id").eq("id", id),
      "Other draft query",
    ).length,
    0,
  );
  assert(
    (await anon.storage.from("event-posters").createSignedUrl(path, 30)).error,
  );
  assert(
    (
      await stranger.client.storage
        .from("event-posters")
        .createSignedUrl(path, 30)
    ).error,
  );
  const privatePage = await fetch(`${origin}/me/events/${id}`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(privatePage.status, 200);
  assert.match(await privatePage.text(), /FESTIVA 자동검증 초안/);
  assert.equal(
    (
      await fetch(`${origin}/me/events/${id}`, {
        headers: { Cookie: strangerLogin.cookie },
      })
    ).status,
    404,
  );
  pass(
    "no-signup first submission, visitor cookie, poster upload and private drafts",
  );

  const attemptedEdit = await action(
    "saveEventAction",
    [form(id, "타인 수정", "published", false)],
    `/events/${id}/edit`,
    strangerLogin.cookie,
  );
  assert(attemptedEdit.result.error);
  assert(
    (
      await owner.client
        .from("events")
        .update({ author_id: stranger.id })
        .eq("id", id)
    ).error,
  );
  assert(
    (
      await owner.client
        .from("events")
        .update({ publication_status: "hidden" })
        .eq("id", id)
    ).error,
  );
  assert(
    (
      await owner.client
        .from("event_images")
        .update({ storage_path: `${owner.id}/${id}/missing.jpg` })
        .eq("event_id", id)
    ).error,
  );
  assert(
    (
      await stranger.client.storage
        .from("event-posters")
        .upload(`${owner.id}/${id}/intrusion.jpg`, image, {
          contentType: "image/jpeg",
        })
    ).error,
  );
  assert(
    (
      await owner.client.storage
        .from("event-posters")
        .upload(`${owner.id}/${id}/bad.svg`, "<svg/>", {
          contentType: "image/svg+xml",
        })
    ).error,
  );
  pass(
    "author identity, moderation fields, metadata paths, upload folders and MIME types are protected",
  );

  const published = await action(
    "changePublicationAction",
    [id, "published"],
    `/me/events/${id}`,
    ownerCookie,
  );
  assert(published.result.success);
  assert.equal(
    ok(
      await anon.from("events").select("id").eq("id", id),
      "Public event query",
    ).length,
    1,
  );
  const signed = ok(
    await anon.storage.from("event-posters").createSignedUrl(path, 30),
    "Public poster signing",
  );
  assert.equal((await fetch(signed.signedUrl)).status, 200);
  await owner.client.storage.from("event-posters").remove([path]);
  ok(
    await owner.client.storage.from("event-posters").download(path),
    "Referenced poster cannot be deleted",
  );
  let publicPath = `/korea?event=${id}`;
  const detail = await fetch(`${origin}${publicPath}`);
  assert.equal(detail.status, 200);
  const html = await detail.text();
  assert.match(html, /<h2[^>]*>FESTIVA 자동검증 초안/);
  assert.match(html, /poster-modal__image/);
  assert(!(await (await fetch(`${origin}/sitemap.xml`)).text()).includes(id));
  const redirect = await fetch(`${origin}/events/${id}/old-title`, {
    redirect: "manual",
  });
  assert.equal(redirect.status, 308);
  const search = await fetch(
    `${origin}/korea?q=${encodeURIComponent("자동검증")}`,
  );
  assert((await search.text()).includes("FESTIVA 자동검증 초안"));
  assert.equal(
    (await fetch(`${origin}/regions/${encodeURIComponent("테스트-지역")}`))
      .status,
    200,
  );
  pass(
    "publication, public poster access, modal HTML, search, sitemap exclusions and legacy redirect",
  );

  const edited = await action(
    "saveEventAction",
    [form(id, "FESTIVA 수정된 행사", "published")],
    `/events/${id}/edit`,
    ownerCookie,
  );
  assert.equal(edited.result.id, id);
  publicPath = `/korea?event=${id}`;
  const updated = ok(
    await owner.client
      .from("events")
      .select("event_images(storage_path)")
      .eq("id", id)
      .single(),
    "Updated image",
  );
  const updatedPath = (
    Array.isArray(updated.event_images)
      ? updated.event_images[0]
      : updated.event_images
  ).storage_path;
  paths.push(updatedPath);
  assert.notEqual(updatedPath, path);
  const remainingFiles = ok(
    await admin.storage.from("event-posters").list(`${owner.id}/${id}`),
    "List replaced poster files",
  );
  assert(
    !remainingFiles.some((file) => file.name === path.split("/").at(-1)),
    "Old poster must be removed from storage metadata",
  );
  const unpublished = await action(
    "changePublicationAction",
    [id, "draft"],
    `/me/events/${id}`,
    ownerCookie,
  );
  assert(unpublished.result.success);
  assert.equal(
    (
      await fetch(
        `${origin}/events/${id}/${encodeURIComponent(edited.result.slug)}`,
      )
    ).status,
    404,
  );
  assert(!(await (await fetch(`${origin}/sitemap.xml`)).text()).includes(id));
  assert(
    (await anon.storage.from("event-posters").createSignedUrl(updatedPath, 30))
      .error,
  );
  await action(
    "changePublicationAction",
    [id, "published"],
    `/me/events/${id}`,
    ownerCookie,
  );
  pass(
    "published edits, image replacement cleanup, unpublication and sitemap removal",
  );

  const reported = await action(
    "reportEventAction",
    [id, "테스트용 잘못된 정보 신고입니다."],
    publicPath,
    strangerLogin.cookie,
  );
  assert(reported.result.success);
  assert(
    (
      await action(
        "reportEventAction",
        [id, "중복 테스트 신고입니다."],
        publicPath,
        strangerLogin.cookie,
      )
    ).result.error,
  );
  assert.equal(
    ok(
      await owner.client.from("reports").select("id").eq("event_id", id),
      "Owner report privacy",
    ).length,
    0,
  );
  ok(
    await stranger.client.auth.updateUser({ data: { role: "admin" } }),
    "Update ordinary metadata",
  );
  assert.equal(
    ok(
      await stranger.client
        .from("reports")
        .update({ status: "resolved" })
        .eq("event_id", id)
        .select("id"),
      "Non-admin report update",
    ).length,
    0,
  );
  const report = ok(
    await moderator.client
      .from("reports")
      .select("id")
      .eq("event_id", id)
      .single(),
    "Admin report read",
  );
  // The application admin UI/actions were removed; trusted moderation is a DB operation.
  ok(await moderator.client.from("events").update({ publication_status: "hidden" }).eq("id",id), "Trusted event moderation");
  ok(await moderator.client.from("reports").update({ status: "resolved" }).eq("id",report.id), "Trusted report resolution");
  assert.equal(
    ok(
      await anon.from("events").select("id").eq("id", id),
      "Hidden event query",
    ).length,
    0,
  );
  assert(
    (
      await action(
        "changePublicationAction",
        [id, "published"],
        `/me/events/${id}`,
        ownerCookie,
      )
    ).result.error,
  );
  pass(
    "report creation/deduplication, report privacy, role escalation prevention and admin hiding",
  );

  ok(
    await moderator.client
      .from("events")
      .update({ publication_status: "draft" })
      .eq("id", id),
    "Restore test draft",
  );
  const deleted = await action(
    "changePublicationAction",
    [id, "deleted"],
    `/me/events/${id}`,
    ownerCookie,
  );
  assert(deleted.result.success);
  assert.equal(
    (
      await fetch(`${origin}/me/events/${id}`, {
        headers: { Cookie: ownerCookie },
      })
    ).status,
    404,
  );
  pass("soft deletion and loss of edit access without the author cookie");
} finally {
  // Cleanup only identifiers allocated in this run, never unrelated records.
  for (const id of eventIds) {
    const result = await admin
      .from("event_images")
      .select("storage_path")
      .eq("event_id", id);
    for (const row of result.data || []) paths.push(row.storage_path);
    for (const user of users) {
      const listing = await admin.storage
        .from("event-posters")
        .list(`${user}/${id}`);
      for (const item of listing.data || [])
        if (item.id) paths.push(`${user}/${id}/${item.name}`);
    }
  }
  if (paths.length)
    ok(
      await admin.storage.from("event-posters").remove([...new Set(paths)]),
      "Remove test posters",
    );
  for (const id of eventIds)
    ok(await admin.from("events").delete().eq("id", id), "Remove test events");
  for (const id of users)
    ok(await admin.auth.admin.deleteUser(id), "Remove test users");
  console.log("Cleaned all synthetic integration fixtures");
}
