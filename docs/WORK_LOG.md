# Work Log

## 2026-11-25 - Mobile overhaul, stage 5: detail and sizes

- Phones: the event detail fills the screen with a sticky 52px top bar (language left, 44×44 close right) so nothing floats over the poster; poster ≤42dvh, title 22px, body 15px, captions 12px, every action ≥44px tall; list metadata no smaller than 12px. PC detail unchanged.
- Checks: `qa-m5.mjs` 10/10 (full screen, close 44×44 in the bar, poster below the bar, no text <12px, actions ≥44px, bar sticks while scrolling, close works, PC centred); regression split 79, search/actions 23, nearby 33.

## 2026-11-25 - Mobile overhaul, stage 4: home

- Phones: wordmark top-left and tools top-right (they used to collide with the coordinates at the bottom); the globe sits between the top bar and a bottom dock with a one-line intro, one-tap country buttons with event counts (대한민국 806 · 대만 3 · 프랑스 401) plus "다른 나라 요청", and a labelled "＋ 행사 올리기"; coordinates, zoom, the select and the bare + are hidden. All sizes: a light globe placeholder ("지도 불러오는 중…") until the map is ready, instead of a blank page. The request dialog returns focus to whichever control opened it. PC layout otherwise unchanged.
- Checks: `qa-m4.mjs` 13/13 (placeholder then globe, no overlaps, one screen without scroll, shortcuts and counts, request dialog, France shortcut, PC dock hidden and select kept); regression split 79, nearby 33, polish 17.

## 2026-11-25 - Mobile overhaul, stage 3: sheet

- Category chips moved to a fixed row under the search (header area 144px + safe area). The collapsed sheet (172px) shows the heading with map/list and a compact first event (48×64 thumb, one-line title, date), tappable; filters (sort/date/region/settings) and tag chips moved into the sheet body as a sideways-scrolling row so labels are never cut ("최신 등록순"). Nearby/selection bar no longer repeats the heading label.
- Checks: 360×664 tour (no overlaps except header containment); regression split 79, nearby 33, tags 21, category 16, header/search 10 (QA selectors moved to the new places: chips on top, tags/settings after opening the sheet).

## 2026-11-25 - Mobile overhaul, stage 2: header, menu, search

- Phone header slimmed to 48px: ← · wordmark · country · + (40px circle) · ≡ menu (`MobileMenu`: saved, account, language — moved out of the sheet settings). Always-visible search row (52px, 16px input, × clears) under the header; the settings panel keeps only custom dates and reset/apply. `--atlas-mobile-header-height` (100px + safe area) is set on :root so the portalled sheet's top follows it.
- Checks: `qa-m2.mjs` 10/10 (search visible and applies, × clears, menu opens/closes inside the screen, settings without search/tools, no horizontal scroll); regression split 79, nearby 33, tags 22, category 16.

## 2026-11-25 - Mobile overhaul, stage 1: map slots

- User: "모바일이 엉망이야" (Galaxy, KakaoTalk in-app, ~360×664; credits expanded over the map, two pills stacked over clusters). Planned by Antigravity (`.omc/plans/mobile-overhaul.md`, 5 stages), user chose "stage by stage to the end".
- Stage 1: basemap credits on phones are our own ⓘ button (MapLibre's compact control re-opened in in-app browsers); zoom buttons and the whole-globe button hidden on phones; "near me" moved bottom-right above the sheet; "search this area" and notices share the top-centre slot (never both); the floating map/list pill moved into the sheet heading; map buttons step aside while the sheet is tall; "search this area" cleared after near-me flies. Collapsed sheet heights 154/190 px for the taller heading.
- Checks: 360×664 tour (no unexpected overlaps); regression split 79, nearby 33, group 18, tags 22, category 16; `npm test` 71.

## 2026-11-25 - Flow/design review and quick polish

- Screenshot tour of production (PC 1366 and mobile 390): home, country, list, detail, settings, empty search, saved, my events, create, Taiwan, English. Findings: home explains nothing and stays blank until the globe draws (~8 s first visit, ~2 s after), France hidden behind the globe, visit counter overlapping the wordmark on phones; mobile search behind the settings icon; empty results with no way out; the add button an unlabelled "+"; inconsistent navigation between map and /me pages; detail actions crowding the description; region chips cut off; coordinate readout covering the mobile view switch; English/Taiwan region chip languages mixed.
- Quick polish (user chose the recommended batch; planning skipped as small fixes): detail actions spaced from the description and the official link first as a filled pill; region chips fade at the edge; coordinate readout hidden on country maps (kept on the home globe); home add button labelled "행사 올리기" (circle ≤480px, class-based, no :has()); empty results offer "검색·필터 지우기" (desktop link, mobile sheet button); fixed visit counter hidden on phones.
- Checks: `npm test` 71; local production-build QA (`qa-polish2.mjs`) 17/17; regression split 79, group 18, nearby 33, search/actions 23, tags 22 (the QA browser now uses SwiftShader: hardware WebGL in headless Chrome stalled on this machine). Review: no blocking findings; applied class instead of :has(), narrower fade without padding, margin specificity.
- Next from the review: home redesign (one-line intro, loading state, country shortcuts incl. Paris, today/this weekend), mobile search box, consistent navigation, region chip languages.

## 2026-11-25 - Near me

- Planned by Antigravity (`.omc/plans/nearby.md`), user chose "as planned". Map control `data-locate-me` (country pages; globe reset icon changed from ◎ to a globe), geolocation only on tap (phones GPS then network fallback, desktop network), blue dot + accuracy circle under event markers, fly by accuracy, nearest events from the current map points within 10/30/50 km through the selection list (desktop panel and mobile sheet, distance per row). Region pages, area searches and shared event links hand the position over (module memory, 10 s, cleared by timer) to the whole-country view; another supported country gets a "go to that map" notice; unsupported places a notice. `Permissions-Policy: geolocation=(self)`. Position never stored, put in a URL or sent.
- Checks: `npm test` 71; local production-build QA (`qa-nearby.mjs`, emulated position) 33/33 — header, list with sorted distances, filters kept, denied/approximate/rough/unsupported notices, France→Korea hand-off, region/area/event-link widening, late answer after switching to France does nothing, mobile sheet, no lat/lng in any request, home globe without the button. Regression: split 79, basemap 19, group 18, search/actions 23, tags 22, polish 10.
- Review: no leak; fixed late answers acting on a newer page (callbacks through refs, pending answers dropped when the view changes), shared event links searching one point, notices now translate on render. Known limit: bounding-box country detection.

## 2026-11-25 - Wider search, directions and calendar

- From the feature audit (search missed tags/descriptions: 뮤지컬 13 vs 70 tagged, 무료 0; no directions or calendar). Planned by Antigravity (`.omc/plans/search-and-actions.md`; the first ask returned empty and was re-asked), user chose "as planned".
- Search: `src/lib/event-search.ts`, one PostgREST `or` per word (AND across ≤4 words): title/region/venue/address, tag or category by exact label in ko/en/zh (reverse index from TAG_LABELS + messages; "기타" excluded), description only for CJK ≥2 / Latin ≥4 chars, 무료/free/免費 also 'gratuit'. Unsafe and control characters stripped after NFKC; multi-word labels matched as whole words.
- Detail: `src/lib/event-actions.ts` + `EventDetailActions` under the facts. Directions by coordinates — Korea Naver/Kakao/Google (Naver `p/directions/-/lng,lat,name,,/-/transit` checked in a browser: desktop fills the destination, mobile hands it to Naver's route search), elsewhere Google. Calendar: Google link + .ics (RFC 5545, VALUE=DATE, exclusive end, 75-octet folding); ≤7 remaining days → that range, longer → one picked day; none when undated/ended/cancelled/postponed.
- Checks: `npm test` 66; local production-build QA (`qa-search-actions.mjs`) 24/24 — 뮤지컬 72 ≥ 70 tagged, musical/音樂劇 same, 무료 221 (kr) / 238 (fr), 서울 뮤지컬 40, art in Paris 62 of 401, special chars safe, noindex kept, three Korean links, Google-only abroad, .ics download, day picker, mobile 40px buttons. Regression: split 79, tags 22, group 18, France 27, category 16. Review: no blocking findings; fixed control characters, whole-word phrases, extra spaces, stray CR in .ics, malformed dates, longer blob lifetime, keyed actions per event.
- Known limit: the .ics download may do nothing inside some in-app browsers (KakaoTalk/Instagram webviews); Google Calendar works there.

## 2026-11-25 - Polish: all-regions label, basemap retry

- The first region chip / mobile region option reads "전국" for Korea and "전체" for Paris and Taiwan.
- Basemap: after falling back to the globe, it retries on `online` or on a map move once 30s/60s/120s have passed (3 in a row; a loaded tile resets the count; the home globe only past the attach zoom). Planning skipped as small fixes.
- Local production-build QA: `qa-polish.mjs` 10/10 (labels on desktop/mobile for kr/fr/tw; blocked tiles fall back, `online` re-attaches, a move within the backoff does not); move after 31s retries (zoom button 3/3; a drag-based version passed only intermittently — the headless drag sometimes produced no move). Regression: basemap 19, split 79, group 18, France 27, tags 22. Review: no blocking findings; retry count now resets on success.

## 2026-11-25 - Desktop map groups fill the list panel

- Planned by Antigravity (`.omc/plans/desktop-cluster-list.md`), user chose "as planned". On desktop, a cluster circle, grouped poster or the hover popup's "전체 N개 보기" now replaces the left list with that group (map order, 24 per page, client pager, URL unchanged) instead of opening EventClusterDialog; "전체 목록" restores the list; a folded panel opens; sort is locked while a group is shown; map moves and "지도에서 보기" keep it, filter changes clear it. Single points still open the detail. Mobile sheet and the home globe modal unchanged.
- `EventMap.onSelectGroup` (groups only; mobile `onSelectEvents` keeps priority), `useGroupEvents` (reuses list rows, fetches the rest from `/api/map-posters`, aborts older requests; page and rows are keyed to the selection so a new group never shows the previous page or rows for a frame), empty notice, focus moves to the list on clear/page.
- Local production-build QA (scratchpad `qa-group.mjs`) 18/18: Paris grouped poster (3), Korea Seoul cluster (512 events, 22 pages, page 2 loads other rows), clear, fold, category change, single poster. Regression: split 79, category 16 (one timing flake, 3/3 on rerun), France 27, tags 22, posters 23 (cards check now looks at the group list's w=192 thumbs). `npm test` 54. Review: no blocking findings; one-frame page/rows glitch, empty notice, focus and stale highlight fixed.

## 2026-11-25 - HTML entities in imported text

- Live data had raw entities in 10 published rows: culture info `&times;`, `&eacute;`, `&Eacute;`, `&laquo;`, `&raquo;`, `&ndash;` (decoder only knew a dozen names, case-insensitively) and Paris `&#58;` (listing double-encodes; Paris decoded once).
- New `scripts/html-entities.mjs`: full Latin-1 named set plus common typographic ones, case-sensitive (only amp/lt/gt/quot/nbsp also in all caps), `Object.hasOwn` lookup, repeated rounds, no NUL/surrogates. Culture info re-exports it; Paris decodes descriptions, titles and venue names with 2 rounds.
- Paris dry run `--sql`: 464 upserts, no entity left. Existing rows fixed in SQL with the exact 7 entities found (checked list first), 0 remaining; `/korea?q=김소현` shows "김소현×손준호". `npm test` 54.

## 2026-11-25 - Tag filter

- User asked whether the tag filter existed: tags were stored with the category filter but had no UI. Planned by Antigravity (`.omc/plans/tag-filter.md`), user chose "as planned"; deviation: no GIN index (~1,250 events).
- `src/lib/event-tags.ts` (labels, `isEventTag`, `selectVisibleTags`, `countTags`), `TagChips`, `DiscoveryFilters.tag` (needs a category; `.contains("tags", [tag])` on list and markers), chip counts from `listEventMapPoints({ withTags: true })` without the tag (reused as the marker query when no tag is set; tags stripped before reaching the client), 25 translations, mobile lowest snap 144→180px with the row.
- Checks: `npm test` 54; local production build QA (scratchpad `qa-tags.mjs`) 22/22 — Korea performance chips 콘서트·연극·뮤지컬·무용·국악, musical 70 of 555, region keeps tag, category change drops it, Korea exhibition no row, Paris exhibition 8 chips, invalid tags ignored, noindex + canonical, mobile row inside the lowest sheet and below the view switch, reset keeps tag; sheet 144→180→144 when the row appears/disappears. Regression: split 79, category 16, France 27.
- Review: no blocking findings; fixed a mount-time snap warning.
- Noticed: a culture-info title shows a raw `&times;` ("김소현&times;손준호") — `decodeEntities` lacks named entities beyond the basic ones.

## 2026-11-25 - TourAPI thumbnails checked, Taiwan poster reduced

- TourAPI `firstimage2` is a 300x200 copy squashed out of the poster's aspect ratio (PNG ones still 98-137KB), and all 43 active TourAPI images are KOGL Type 3, so TourAPI stays original.
- Taiwan "Pingtung Luoshanfeng Art Festival" official image is 8000x6000 / 14.7MB, past Vercel's optimizer limit, and the only image in the feed. User chose a reduced copy on this site (OGDL-1.0 allows modification): `public/assets/posters/Event_A15010000H_081870.jpg` (1200x900, 119KB), `localPoster` in `data/taiwan-events.json`, import validates path/JPEG/size.
- Migration `202611250001_taiwan_local_poster.sql` lets the taiwan_tourism branch also accept `/assets/posters/Event_<id>.jpg`; tested in a rolled-back transaction (live constraint equals 202611240004, local path accepted, traversal and other sources rejected).
- Deployed (6472995), confirmed the copy and its w=192 webp (3KB) live, then applied the migration and switched the row's `source_image_url` in one transaction. `/taiwan` now references the local thumb and no longer the 14.7MB URL; `/images/events/1a857158-…` redirects to the 119KB copy.
- Also: `/me/saved` sign-in button capped at 320px and centred (was full page width); checked at 1905px and 390px on production (6c58924).
- `isResizablePoster` accepts that path; `images.localPatterns` allows only `/assets/posters/**` without a query (other local paths 400). `/images/events/[id]` resolves the local path against the request URL.

## 2026-11-25 - Lighter posters

- Measured originals: culture.go.kr 35KB-1.3MB (up to 1190x1684), cdn.paris.fr 350KB-1MB (1200x750, no smaller variant on the CDN), tong.visitkorea.or.kr 28-507KB, while list thumbnails are 84x112 and markers 48x48.
- Planned by Antigravity (`.omc/plans/poster-images.md`). User chose "public images only, TourAPI stays original" (KOGL Type 3 forbids alteration); the user-upload thumbnail part (DB/RLS/action changes) is deferred.
- `next.config.ts` images: remotePatterns from `src/lib/poster-hosts.ts` (culture.go.kr, cdn.paris.fr, **.gov.tw, **.taiwan.net.tw), webp only, quality 70, widths 192/384, 31-day cache. `posterSrc()` (getImageProps) gives list rows and map markers the same w=192 URL and cards w=384; the detail dialog keeps the original. List/card images and map markers retry once with the original on failure (markers hide after that), including failures before hydration (ref check).
- Local QA on a production build (scratchpad `qa-posters.mjs`, all pass): list thumbs webp, median 4-7KB, max 13KB; Paris first screen 37 images 138KB in total; cards max 12KB; TourAPI rows still original; fallback works when `/_next/image` returns 500. Regression: `qa-split` 79, `qa-category` 16, `qa-france` 27; `npm test` 52.
- Production (commit 6d8913b): same QA passes on world-map-imtc.vercel.app; `/_next/image` responses carry `max-age=2678400` and the second request is `x-vercel-cache: HIT`. Exceptions: animated GIF posters from culture.go.kr pass through as GIF (34KB sample); one Taiwan image (taiwan.net.tw `6ef2531f-….jpg`, 14.7MB source) is returned unresized, presumably over Vercel's source-size limit — it was just as heavy before; fix by replacing that curated image.
- Remaining weight: TourAPI originals (13 images ~2MB on the festival filter). A follow-up could use TourAPI's own smaller `firstimage2` (provider thumbnail, not an alteration).

## 2026-11-24 - Sync secrets registered

- User registered the five GitHub secrets (TOUR_API_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_IMPORT_PROJECT_REF, SUPABASE_IMPORT_SERVICE_KEY).
- Dry runs on GitHub: TourAPI 59 usable, Paris 406 usable, culture info first stopped on its repeat check (the listing's pages are not in a stable order) — fixed by fetching it in one page (commit "Fetch the culture listing in one page"), then 800 usable.
- No apply run yet: user chose to let the Monday schedule write (TourAPI 01:00 KST, culture info 02:00 KST, Paris 11:00 KST). Check those runs and the event counts afterwards.

## 2026-11-24 - Category filter (category + tags)

- Korea grew to ~830 events; user asked for a category filter. Planned by Antigravity (`.omc/plans/category-filter.md`); user chose to store category + finer tags. Deviations: backfill by re-running the imports with `--sql` (GitHub secrets not set), mobile chips inside the sheet header.
- Migrations `202611240005` (category, tags, index, festival backfill) and `202611240006` (per-element tag check via `valid_event_tags`), both tested in rolled-back transactions, then applied. Paris and culture rows re-upserted with categories: culture 574 performance / 212 exhibition / 1 festival; Paris 236 exhibition / 145 festival / 25 other; TourAPI 111 and Taiwan 6 festival.
- App: `?category=` in DiscoveryFilters (list + map, noindex), CategoryChips on desktop and mobile, row label, event form category select (validation default other; stale pages keep the saved category). Import scripts write category/tags; SQL generators quote arrays.
- Review fixes: festival import writes category, per-element tag check (no NULL/comma/double hyphen), mobile reset keeps the chip category, stale clients cannot reset category.
- QA: category 16 PASS (desktop/mobile filter, region link keeps it, clear, empty state, invalid fallback, noindex), split 79, France 27, Korea culture 11, country requests 34; unit tests 50.

## 2026-11-24 - Korean culture data (한눈에보는문화정보)

- Korea had 43 active events (TourAPI festivals only). User applied for data.go.kr 15138937; the "unregistered key" errors were ours: the stored key is already URL-encoded and was encoded twice.
- Planned by Antigravity (`.omc/plans/korea-cultureinfo.md`); user widened it to performances ≤90 days. `scripts/import-cultureinfo.mjs` + `cultureinfo-lib.mjs` (tested), migration `202611240004` (kcisa_culture owner-check branch, applied after a rolled-back test with all rows), weekly `cultureinfo-sync.yml`, CSP `www.culture.go.kr`, modal source/license label and no empty description block.
- Measured: 1,032 listed → 786 published (Seoul 390+, all 16 provinces under the TourAPI names). Korea now shows ~830 active events.
- Review fixes before shipping: the TourAPI duplicate filter kept duplicates (`!skip()` is true) — fixed, 2 rows hidden; tag stripping after decoding deleted `<title>` parts of titles — XML decoded once, only real tags stripped, then entities; key encoded exactly once whatever form it is stored in; CDATA unwrapped; padded dates; refuse a listing that repeats items; short titles cannot match by containment; the `--sql` output also hides rows that left.
- QA: Korea culture 11 PASS, split 79, France 27, basemap 19, country requests 34; unit tests 48.

## 2026-11-24 - Country requests

- Instead of adding every country, visitors can request one: home select → “+ 다른 나라 요청하기…” → searchable dialog of ~246 unsupported ISO countries. Planned by Antigravity (`.omc/plans/country-requests.md`), approved; deviation: local/preview never write (shared production DB).
- `country_requests` (visitor hash + ISO code, one vote each), `record_country_request` (analytics write key) and `country_request_summary` (admin only) RPCs; migration tested in a rolled-back transaction, then applied. `/admin` shows the ranking.
- Review fixes (migration `202611240003`, applied): requests use their own cookie and hash prefix (not joinable to analytics); a daily-rotating keyed network hash caps new requests at 20 per network per day so dropping cookies cannot stuff the ranking; anon EXECUTE on the summary revoked; a full throttle map evicts its oldest entry; particle-free duplicate message; search matches the name in any UI language with cached `Intl.DisplayNames`.
- QA: 34 PASS (desktop + mobile dialog, no navigation, focus return, Taiwan navigation still works, API 403/400 guards); unit tests 42 PASS.

## 2026-11-24 - France (Paris) as a third country

- Researched event open data for Japan, Hong Kong/Singapore, Thailand and Paris; only Paris "Que faire à Paris" (ODbL, no key, coordinates, images, photo credits) was ready. Planned by Antigravity (`.omc/plans/france.md`), approved as-is.
- `countries.ts` is now the single country list (`iso`, `COUNTRY_CODES`, `COUNTRY_PATHS`, `countryByPath`); kr|tw hardcodes in the repository filter, sitemap, SEO, analytics, actions, admin, geocode, globe, site chrome and event form follow it.
- Migration `202611240001_france_events.sql` (applied to the live DB): `fr` country/location checks, `source_image_credit`, `paris_qfap` branch of `events_source_owner_check`, analytics path/country checks. Tested first in a rolled-back transaction with all rows.
- `scripts/import-paris.mjs` (dry run / `--sql` / `--apply`) + weekly `paris-sync.yml`. Selection measured on live data: 2,960 upcoming → 406 (festivals 151, exhibitions ~240, fairs ~25; plain concerts/plays and workshops left out). First load applied through the Management API.
- `/france`: Paris arrondissement chips, French text marked `lang="fr"`, photo credit under the modal poster, ODbL source line and list footer notice, CSP `img-src` + `https://cdn.paris.fr`, France boundary (Natural Earth 50m, metropolitan) for the globe.
- Review fixes: the event form offered France but validation only allowed kr|tw (now `COUNTRY_CODES`); listing dates are UTC calendar days (end 23:59Z), so Paris-time conversion had pushed 135 end dates a day late — now the UTC date, live rows re-upserted; sync retirements use `hidden` (revived when the event returns; admin `deleted` stays), never retire rows whose image check failed, and refuse to write if under 70% of published rows survive; NUL/surrogate/out-of-range entities dropped; missing dates skipped instead of crashing; image check fetches one byte with 4 workers; workflow `concurrency` group.
- QA: France 27 PASS (list/map/modal/credit/region filter/no CSP issues/home select → /france/mobile/sitemap/no site header), split-layout 79 PASS, basemap 19 PASS.

## 2026-11-24 - Detailed basemap (OpenFreeMap)

- User: zooming past country level showed nothing and no place names. Options compared (Google/Naver/Kakao rewrite vs MapLibre + vector tiles); user chose free OpenFreeMap. Planned by Antigravity (`.omc/plans/basemap.md`), approved as-is.
- `src/lib/map-style.ts`: light OpenMapTiles-schema style (water, landcover/park, waterways, buildings z14+, state/country boundaries, roads with casing, place/water/road labels), labels per UI locale, Hangul/CJK via `localIdeographFontFamily`.
- `event-map.tsx`: basemap inserted under the grid and event layers; world.json land, grid and background fade out over z4→5. Home globe attaches it only at z ≥ 3.5. Source errors before any tile (or 3 errors) remove it and restore the globe. Attribution bottom-right, collapsed ⓘ on mobile. Picker map unchanged.
- CSP `connect-src` + `https://tiles.openfreemap.org` (TileJSON, tiles, glyphs all on that origin; checked the live TileJSON).
- Review fixes: basemap layers get `minzoom` 4 (opacity 0 still downloads tiles, so a zoomed-out globe fetched them after the first zoom-in); the home globe's country fill fades to 0.08 over the basemap (still the click target); non-basemap map errors are logged again (an error listener silences MapLibre's console output); the tile error count resets on each loaded tile; the grid is not recomputed while hidden; picker attribution colour and CJK font option left as before.
- QA: home makes 0 tile requests until zoom and none again after ◎ back to the globe, /korea loads tiles + glyphs with no CSP violations, Korean and English labels checked on screenshots, blocked tile server falls back to the globe without the error screen, mobile attribution clears the sheet; split-layout regression 79 PASS.

## 2026-11-24 - Serve from Seoul

- `/korea` took ~1.1s to first byte: `x-vercel-id: icn1::iad1` showed pages rendered in Washington DC while Supabase is in Seoul (`ap-northeast-2`), so every auth/list/region/map query crossed the Pacific.
- `vercel.json` now pins functions to `icn1`. Region chips no longer prefetch every region page on load (~15 background RSC requests).

## 2026-11-24 - Map-app style controls and list

- User found the inputs too big and shared a map-app screenshot as the target (high contrast, clearly separated). Followed its layout cues, not its branding.
- Desktop panel top 322px → 162px: country select moved into the header row (32px), one prominent search box (46px, 2px accent border), date/sort as 34px pills, region chips moved onto the map as floating white pills with shadow (active = solid accent).
- List rows are flat: no card boxes, divider lines, title first in the accent colour at 16px bold, date `#222`, place/region `#767676`. Selected row gets an accent bar.
- Neutral greys replace the blue-greys. Mobile sheet filters 44px → 36px pills; sheet rows use the same divider style.
- QA: split-layout script 79 PASS (adds custom-date form placement and first region chip visible).

## 2026-11-24 - Contrast pass

- The design read too pale (secondary text `#7890af` ≈ 3.3:1, borders `#e5ecf5`, land barely different from sea). User chose to apply all six ideas.
- Secondary text `#52657f` (≈ 5.9:1) at 12px, titles `#0f1f3a`; borders `#d3dce8`/`#c4d1e3`; gray list panel with white cards and an edge shadow.
- One accent `#1f5fd1`: active region chip, selected row and "이 지역에서 검색" are solid blue with white text. Status badges more saturated.
- Map: land `#d9e6f7` (opaque) with `#5d8bd0` outline, grid opacity 0.38 → 0.22 (also applies to the home globe). Site tools, zoom controls and coordinates get a white background and shadow.
- QA: split-layout script 75 PASS; screenshots checked on desktop, mobile list and home globe.

## 2026-11-24 - Desktop split: list left, map right

- Planned by Antigravity (`.omc/plans/desktop-split.md`), approved as-is.
- Desktop (>700px) explorer is now a left list panel (`clamp(340px, 30vw, 400px)`, EventListItem rows, search/date/sort/regions/total, pagination) beside the map. The panel collapses via a toggle on its border; MapLibre's ResizeObserver resizes the map.
- Removed the desktop map|list toggle and the map-less desktop list page; `?view=list` still opens (same split) and keeps its mobile meaning. SiteTools no longer carries the poster-panel toggle.
- PC now has "이 지역에서 검색" after a user drag/zoom (`?bounds=`), cleared with the summary chip. Row hover ↔ map poster highlight both ways.
- Mobile path unchanged (bottom sheet, floating 목록보기). URL/SEO rules unchanged.
- Review fixes: desktop and mobile share one tree shape so the map is not remounted when the viewport check flips to mobile after hydration; on a phone the server-rendered split shows only the map; `fitToPoints` no longer depends on `bounds`, so a region-page bounds search keeps the user's viewport; desktop links no longer carry `view=list`; removed CSS for the old floating poster panel.
- QA: headless Chrome at 1280/900/390 — layout, independent list scroll, collapse + map resize, search-area only after a user drag, bounds round-trip, `?view=list&sort=ending`, /taiwan, region page, mobile list switch, mobile SSR (no JS) map-only, mobile map created once, region bounds search keeps viewport — 75 PASS.

## 2026-11-23 - List view (map ↔ list)

- Planned by Antigravity (`.omc/plans/list-view.md`), phase 1 only. The optional sort indexes were skipped (117 published events), so there is no DB change.
- `?view=list` is a client switch (`history.replaceState`), so the map is not reloaded. `?sort=soon|ending` is a server sort in `listEvents` that also hides ended events. Both are kept in pagination, region and filter links, excluded from canonical URLs, and make the page noindex.
- Mobile: a floating `목록보기/지도보기` button is portalled to `<body>` next to the react-modal-sheet portal and rides above the sheet using `--mobile-sheet-height`. Sheet snap 3 is the list view, and view and snap stay in sync both ways. The sheet heading shows the total and a sort select. Rows use the shared `EventListItem`. "이 지역에서 검색" moved up so it clears the button.
- Desktop: a `지도 | 목록` toggle on the map; list mode is a separate scrolling layout (search, date, sort, region links, total, 2/1-column rows, page N/M).
- `EventListItem` shows the progress badge (`eventBadge`, using the country's local date), save, and "지도에서 보기". The event modal and desktop cards get the same action. `EventMap.focusTarget` flies to the event once the map has loaded, including after a remount.
- Verification: typecheck, 40/40 unit tests (new `list-view.test.mjs`: badge boundaries, sort/view parsing, URL params) and production build passed. Headless Chrome on a local production server: 32 list-view checks, covering toggle and URL, the list layout without a map, badges and actions, region and pagination links keeping view and sort, end-date and start-date ordering, ended events hidden, modal "지도에서 보기" returning to the map, direct URL restore, English labels, 1-column under 1024px, the mobile floating button above the sheet and at the bottom in list mode, 44px row actions, rows fitting 390px (a grid `min-width` bug was found and fixed), and no overflow or page errors. Saved-events QA re-ran 21/21. Local builds are always noindex, so default-page indexability is to be checked on production.
- Review fixes (separate code-review pass, no blockers): a used map focus target is cleared on filter or region changes and when leaving the map, so a region fit is no longer overridden by an old "show on map". Opening the mobile filter panel expands the sheet without switching to the list view. The view now follows `useSearchParams()` instead of the server prop, so back/forward keep the URL and the view in sync (checked in the browser). The PC map shows the sort select while a date sort is active so it can be undone. The badge suppresses a hydration warning that could occur around local midnight. Accepted for phase 1: events with no end date sort last under "종료 임박순", and map markers are not filtered by the date sort.

## 2026-11-23 - Saved events are members only

- User decision: saving requires a Google login, so a guest's list can no longer be stranded in one browser. Applied the change directly, without an Antigravity plan, as a narrowing of the feature just shipped.
- `202611230002_saved_events_members_only.sql`: the insert policy also requires a non-anonymous JWT (`is_anonymous`); any anonymous rows are deleted (there were none); `complete_event_account_handoff` is restored to its 202611100005 definition. The live function hash matches the original again.
- App: the save action rejects anonymous and signed-out users. The layout and `/me/saved` query only for members. A signed-out bookmark click opens the existing Google login dialog with a saving-specific message and returns to the same page. `/me/saved` shows a login prompt instead of a list. Saving never creates an anonymous session now. The account dialog stops Escape and clicks from reaching a parent event modal.
- Verification: typecheck, 38/38 unit tests and production build passed. Rollback-only `saved-events.test.sql` (rewritten) and `auth-handoff.test.sql` passed on the live DB, with no fixtures left. Headless Chrome, signed out, 21/21 checks: login dialog from card, modal and mobile list; Escape closes only the login dialog; copied link format; English prompt; mobile fit and overflow; zero anonymous sign-in attempts. Saving while actually signed in with Google was not automated, because that needs a real Google account.

## 2026-11-23 - Saved events and sharing

- Planned by Antigravity (`.omc/plans/saved-events.md`); analytics events (`event_save`/`event_share`) deferred to a later phase so the live analytics schema stays untouched.
- `202611230001_saved_events.sql`: `saved_events(visitor_id, event_id)` with own-row RLS, insert allowed only for published events, a 200-per-visitor trigger, and `complete_event_account_handoff` extended to merge a guest's saved events into an existing Google account (newest first, capped at 200). First-time Google linking keeps the same user ID, so no merge is needed there.
- Layout reads saved IDs only when a session already exists; read-only browsing still creates no anonymous visitor. `SavedEventsProvider` keeps card, mobile list, modal and the site-tools badge in sync, with optimistic toggle and rollback. The toast renders inside the top-most modal dialog so it stays visible and announced.
- `/me/saved` (noindex, covered by robots `/me/`): active vs ended sections, bulk clear for ended, count-only notice and bulk clear for events no longer public. Links from site tools, header and account dialog. Mobile masthead unchanged.
- Modal share button: Web Share API when present, otherwise clipboard, otherwise a selectable link field. Link format `/<country>?event=ID&lang=<locale>`.
- Review fixes (separate code-review pass, verdict approve): the handoff takes the saved-events lock before counting and runs the merge in its own sub-block so it can never fail the event transfer; re-saving at the limit is a no-op; the save action no longer signs in anonymously from the server; server refreshes keep the optimistic value of in-flight toggles; the toast moves back to `<body>` when its dialog closes.
- Applied `202611230001_saved_events.sql` to the live project through the Management API, after confirming the live `complete_event_account_handoff` matched `202611100005` exactly. New rollback-only `scripts/saved-events.test.sql` passed on the live database: own-row RLS, published-only inserts, duplicate no-op, 200 limit, guest-to-Google merge (dedupe, cap, source rows removed, return value unchanged) and privileges. Existing `auth-handoff.test.sql` passed again. No fixtures remain (checked afterwards).
- Verification: typecheck, 38/38 unit tests (new `saved-events.test.mjs`) and production build passed. Headless Chrome on a local production server with Supabase anonymous sign-in blocked (no live writes): 20/20 checks, covering button placement (desktop card, 44px mobile list button), optimistic state and rollback, error toast above the modal, copied link format, English labels, mobile masthead unchanged, no horizontal overflow and no page errors. A real save and `/me/saved` with data were not exercised in the browser, because that would create a live anonymous user. The database side is covered by the SQL test.

## 2026-11-23 - Docs synced with code; TourAPI sync blocked on secrets

- README still described several features as missing after the 11/18-20 work. Corrected: AI poster extraction (`/api/extract-poster`, optional `ANTHROPIC_API_KEY`), the `/admin` panel (`ADMIN_USER_ID` plus `app_metadata.role = "admin"`, otherwise 404), the weekly TourAPI GitHub Actions sync, the weekly 90-day analytics purge (Vercel Cron, `CRON_SECRET`) and the live deployment at `world-map-imtc.vercel.app`.
- The scheduled `TourAPI Sync` run on 2026-11-22 failed with `TOUR_API_SERVICE_KEY is missing`: the repository has no Actions secrets. All five secrets listed in README must be added; a manual dry-run needs only `TOUR_API_SERVICE_KEY`. Not yet verified that the Vercel production environment has `ANTHROPIC_API_KEY`, `CRON_SECRET` and `ADMIN_USER_ID`. Live `/`, `/korea`, `/taiwan`, `/sitemap.xml` and `/api/traffic` returned 200; `/admin` returned 404 for an anonymous request, which is the expected response.
- Verification: typecheck passed and 35/35 unit tests passed. Docs-only change.

## 2026-11-20 - Merged PRs, Antigravity/Claude workflow, globe click restored

- Merged PR #2 (UI/ops, MIRA-10) then PR #1 (country switch, discovery filters, mobile sheet) after resolving four conflicts on the PR #1 branch (`d2941ec`). Work now happens on `main` only; Multica and the third-party project subagents were removed (`d13f676`, `d89537f`). `CLAUDE.md` records the split: Antigravity plans via `omc ask`, Claude implements.
- Restored click-to-zoom on the home globe for Korea and Taiwan; the feature was lost in the globe.gl → MapLibre rewrite (`f418049`). Hover highlight and tooltip on desktop; event circles inside either country also navigate there on the home globe.

## 2026-11-18 ~ 2026-11-19 - Operations hardening (Multica agent runs)

- Added a design-token UI pass with map-list highlighting (`bea8475`), the weekly TourAPI GitHub Actions sync (`df4d1d3`), error tracking with a global boundary and `/api/log-error` (`675b9a7`), AI poster extraction (`e26614d`, `d48f916`), the `/admin` moderation panel (`3b90301`), security headers/CSP (`2576cef`), an LRU geocode cache, analytics retention and a weekly cleanup cron (`8e1df68`).
- Follow-up fixes: CSP for OSM tiles, the MapLibre worker and posters (`b707d03`); poster-extraction body cap, origin check, rate limit and upstream timeout (`c6bd05d`); an admin check matching RLS (`08ae785`); purge null guard and scheduled TourAPI apply (`0c13911`); atlas/mobile UI fixes (`38c51bd`).

## 2026-11-11 - Verified user deployment and registered production OAuth callback

- User reported pushing the repository and deploying `https://world-map-imtc.vercel.app/`. Direct HTTP verification (web browsing tool could not open the host) returned 200 for home/Korea/Taiwan/robots/sitemap/traffic. Public HTML has correct production canonicals, Google-ready flag and no noindex; robots allows public crawling and points at production sitemap (98 entries, no localhost URLs). Public traffic API returns only the intended three totals.
- Live Supabase Auth still used the local Site URL and allowed only local callbacks. Updated Site URL to the supplied verified production origin and added its exact `/auth/callback`, preserving all existing local redirects and Google/anonymous/manual-linking settings. Reread configuration confirmed success. No secrets printed and no local development origin/environment values changed.
- Updated deployment guide to actual repository/production status. Google consent/login completion, real registration and Search Console/Naver ownership/indexing remain unverified; HTTP checks do not establish these. Existing local country-selector/source changes are still uncommitted and were not silently pushed/redeployed during this verification.

## 2026-11-11 - Visible country select field

- Replaced the subtle text/transparent chooser with a visible 180px white native select, blue-gray border, rounded corners, right-aligned chevron and 44px minimum target. Current-country heading remains visually hidden for correct document semantics; native select itself now displays the country. Preserved native mobile picker, keyboard access, language and direct navigation.
- Country-switch markup/CSS only. Whitespace check and existing bounded desktop/mobile country-switch DOM/navigation checks passed without screenshots. Local changes only; no commit/push/deployment performed.

## 2026-11-11 - Switch countries from the current country name

- Country name now opens a native Korea/Taiwan chooser on desktop and mobile. Kept a plain current-country H1 (or paragraph when the event modal owns the H1), added a small chevron/44px target and keyboard focus indication, and enabled pointer events only on the control inside the non-interactive map heading. Native select is an overlaid sibling, so option labels do not contaminate the heading text.
- New country-switch component navigates directly to the selected country's base route with current UI language, clearing previous region/query/page/event parameters. Homepage selection/back behavior unchanged. Updated explorer, CSS and README.
- Verification: typecheck and whitespace check passed. Bounded headless DOM QA at desktop 1280px and mobile 390px verified hit-testing, both country options, Taiwan/Korea round trips, preserved English UI, cleared filters/page and one correct H1; no page errors/screenshots. Local source updated; this turn did not commit/push or verify a Vercel deployment. Existing `.openai/hosting.json` and generated `next-env.d.ts` modifications left intact.

## 2026-11-10 - Prepared GitHub/Vercel publication (accounts pending)

- User requested Git-backed Vercel deployment. Existing local Git repository has no remote; GitHub/Vercel plugins were discovered but neither is installed/connected. Suggested both and continued local preparation; no remote repository, push, Vercel project, paid plan or deployment has been created. Default intended target is a new private `festiva` repository, subject to actual connected account/name availability.
- Added minimal Next.js `vercel.json`, Node 24.x engine pin/package-lock metadata, `.vercel`/isolated build/log ignores and Korean `docs/DEPLOY_VERCEL.md` with runtime-only environment variables and production Supabase callback setup. Actual keys remain only in ignored local configuration. App needs existing Supabase public config, Geoapify, analytics write key and Google-enabled flag; no runtime Google secret/service-role/management credential required.
- Addressed verified Vercel 4.5MB function request limit: original-image selection remains 10MB/1200px JPEG conversion, transferred JPEG capped at 3MB on client/server and total Server Action budget at 4MB. Added three-language failure messages and meaningful compressed-file boundary/cleanup coverage. Database bucket limit unchanged. No publishing or authentication behavior otherwise changed.
- Verification: production build passed in ignored `.next-deploy-check` using an optional `FESTIVA_BUILD_DIR` config override so the original port 3000 dev output was not overwritten; restored portable generated-type references afterward. Twenty-four unit tests passed; typecheck/whitespace checks passed. Candidate-source scan found no configured server secrets/private-key/token patterns, `.env.local` is ignored and no env/private-key paths appeared in Git history. Legacy already-deleted static dist files belong to the prior migration; pre-existing `.openai/hosting.json` modification left out of the source commit.
- Next: after account connections, inspect identity and repository availability, create/push intended private repository, import/connect it to Vercel with production environment variables, deploy, register exact production OAuth callback and verify live map/auth/registration/SEO/traffic. Do not claim deployment before returned ready state. Do not use arbitrary preview callbacks or copy local development-only variables to hosting.

## 2026-11-10 - Mobile posters collapsed by default

- Mobile catalog now defaults closed, leaving only a small bottom 'show posters' button. Opening displays a 124px horizontal strip with 72px thumbnails instead of the previous 184px panel/106px thumbnails; bottom button closes it again. Coordinates sit above the button/strip, avoiding overlap. The region strip remains always available beneath the masthead, and desktop catalog still defaults open. A shared optional user choice drives both catalog toggles; mobile CSS suppresses the desktop-open SSR panel until responsive hydration.
- Updated explorer and responsive CSS plus README. Typecheck and whitespace check passed. Bounded headless DOM QA at 320/390px verified default hidden catalog, 124px height, thumbnail bounds, toggles, modal open/close, coordinate separation, retained region strip and default-visible desktop catalog. No screenshots, new tests or production rebuild.

## 2026-11-10 - Always-accessible mobile region strip

- Moved regional filter links out of the collapsible search/settings controls into the shared map content. Mobile now shows one horizontally scrollable row directly below the opaque masthead, with 44px targets and existing selected-state styling; selecting a region keeps it centered in the strip after navigation. Country heading/map zoom controls move below this row with safe-area-aware positioning. Search/account/language/catalog/traffic remain in the on-demand panel; desktop regional layout and crawlable URLs preserved.
- Updated explorer, CSS and README. Typecheck/whitespace check passed. Bounded DOM QA at 320/390px verified one visible strip outside the panel, horizontal overflow, below-header placement, no heading overlap, real region navigation/active scroll and desktop resize. No screenshots, new test files or production rebuild.

## 2026-11-10 - Clearer mobile masthead grouping

- Reworked the map's mobile masthead into an opaque white full-width bar with a subtle bottom border so grid lines no longer pass through its contents. Smaller 24px wordmark has its own flexible column; muted back action, paired search/settings on a single faint background with an internal separator, and a blue primary add button establish clear grouping. All actions keep 44px touch targets and consistent 10px corners. Desktop and top-overlay behavior unchanged.
- CSS-only change. Whitespace check passed. Bounded DOM checks confirmed opaque header, separate non-overlapping groups at 320px and the primary action's contrast. Existing mobile overlay QA passed again at 320/390px, including focus, search preservation, Escape, nested account, catalog toggle and desktop resize. No screenshots, tests added or production rebuild.

## 2026-11-10 - On-demand mobile controls over the masthead

- Mobile country/region maps now keep a compact back/brand/search/settings/add row. Search and settings buttons open one native top-anchored dialog covering that row; search, regional links, account/language/catalog controls and traffic are no longer permanently stacked above the map. Country heading moves up to 90px. Existing poster strip and coordinate placement remain; desktop keeps the previous search/filter/toolbar arrangement.
- Added `mobile-atlas-controls.tsx` with a 700px responsive subscription, native focus containment/backdrop/Escape, appropriate initial focus (search input only for search opener), body scroll restoration and opener focus return. Shared controls preserve unsent search text between openings. Catalog toggle closes the panel immediately; links/search keep existing URL navigation. Desktop regional links remain server-rendered/crawlable; CSS hides the desktop shell on mobile before hydration. No map component remount is introduced by opening controls.
- MinimalMasthead accepts optional mobile actions. Updated explorer, responsive CSS, translated control labels and README. Typecheck, 23 unit tests and whitespace check passed. Bounded headless DOM checks passed at 320/390px and desktop resize: collapsed controls absent, panel covers masthead, autofocus, preserved query, Escape/focus return, poster hide, nested account dialog and panel bounds. Corrected search-input Escape consumption and nested account cancel bubbling found during QA. No screenshots or production rebuild.

## 2026-11-10 - Minimal unified account/language/catalog controls

- Replaced separately floating login/language/catalog pills with one compact shared `SiteTools` group. Account and catalog actions are icons with localized accessible labels/native hover titles; language keeps only its selector. Removed individual borders, globe icon in this group and catalog text; one light shared background and thin divider remain. Catalog arrow/expanded state reflects open/closed status.
- Explorer owns the three controls so toggling uses existing local catalog state; SiteChrome renders the account/language group only outside country/region explorers, preventing duplicates. Desktop stays top-right; mobile map tools sit on one row between regional filters and country heading. Other-page/home mobile placement remains bottom-right. Account dialog and in-dialog language controls retain their behavior.
- Updated site-tools, account-control, explorer/site-chrome, translations and responsive CSS; removed obsolete catalog-button positioning. Typecheck, 23 unit tests and whitespace checks passed. Bounded headless DOM checks verified icon-only borderless buttons, exactly one group, catalog hide/show and accessibility state, account dialog/Escape, language switching, desktop/mobile bounds and no search/filter/heading overlap. Adjusted mobile group from 186px to 190px after detecting a 2px filter overlap; final layout check passed. No screenshots or production rebuild.

## 2026-11-10 - Traffic moved beneath the top-left country heading

- Moved country heading from the lower-left map corner to the upper-left below search/filters (below language/account controls on mobile). Rendered traffic inline beneath the country name rather than as a separate fixed bottom overlay. Coordinates remain in their existing lower-left position. Home traffic sits top-left; counters use small muted text with a transparent background. No duplicate country counter or collection/API changes.
- Updated explorer/site-chrome, optional inline counter styling, responsive CSS and README. Typecheck and whitespace check passed. Bounded headless DOM checks at desktop 1280px and mobile 390px verified one counter below the country title, transparent background, no overlap with coordinates/search/filters/account/language controls, and home top-left placement. No screenshots or production rebuild needed for this layout-only change.

## 2026-11-10 - Activated configured Google provider

- User completed Google/Supabase setup. Verified the live Google provider is enabled with a configured client ID; provider secrets were not read into logs or changed. Enabled the previously disabled manual identity linking setting and added the exact localhost/127.0.0.1 application callback URLs while preserving existing redirects and anonymous posting.
- Changed ignored `.env.local` to `GOOGLE_AUTH_ENABLED=true`. Existing port 3000 development server picked it up. No Google secret needed in the runtime app; the user's provider configuration remains in Supabase.
- Verification: reread live auth configuration, confirmed enabled login button, submitted the server OAuth action in a fresh headless browser and observed Google's `accounts.google.com/v3/signin/identifier` page. Stopped before entering credentials or consenting. The initial browser harness clicked before hydration; waiting for the React handler resolved it. Its redirect-interception assertion also missed the main redirect, so the final observed page host/path was used as evidence rather than claiming that assertion passed. Actual account signup, identity conversion, cross-browser sign-in and logout still require a real user's Google login.

## 2026-11-10 - Public corner traffic counters; removed administrator UI

- Replaced the administrator dashboard with a small left-bottom public counter on home/country/region discovery routes: today's estimated browser visitors (Asia/Seoul), cumulative page views and cumulative event-modal views. Mobile placement sits above bottom account/language controls. Three languages; refreshes about once a minute while visible, without requests per map/filter/language change. Private/auth routes omit it; failures do not fabricate zeros.
- Removed `/admin`, `/admin/analytics`, moderation UI/actions and dashboard password/cookie helpers; both former routes now 404. Removed obsolete dashboard CSS, summary types and the admin-password environment entry (including ignored local configuration). Reports and DB protections remain; trusted moderation is now performed through Supabase Dashboard. Google account functionality unchanged.
- Applied `202611100006_public_traffic.sql` through existing MCP: removed detailed `analytics_summary`, added key-protected `traffic_totals` returning only three numbers. `/api/traffic` validates/projects those fields, caches DB reads for 60 seconds and supplies CDN/browser caching. Raw records, browser/session hashes, referrers, write key and settings remain private. Existing collection/dedup/local exclusion retained. No administrator auth required to read the displayed totals.
- Verification: production build and 23 unit tests passed. Live rollback-only SQL verified exact aggregate shape, wrong-key rejection, raw-table protection, cumulative increments and removed detailed RPC. Bounded headless DOM/API checks confirmed live three-number response, former-admin 404s, three UI languages, mobile bounds/control separation, map corner placement and private-page exclusion without screenshots or fixture traffic. Owned QA server stopped; existing port 3000 server untouched. Updated README, smoke/integration test expectations and public-counter contract coverage.

## 2026-11-10 - Optional Google accounts and guest-event handoff

- Added a compact global account control and native dialog, Google signup/sign-in server action, PKCE callback, account event link and local sign-out. Three UI languages supported; no email/password or SMTP. Guest posting remains available. Member registration/private-event notices explain cross-device access. Legacy localStorage drafts stay local.
- Applied `202611100005_google_account_handoff.sql` through the existing project MCP. First-time Google identity linking retains the anonymous ID; existing-account retry uses a 30-minute HttpOnly proof cookie and hashed, inaccessible, single-use claim to move only that guest's events and referenced poster `owner_id` atomically. Existing Storage keys/files stay intact. Direct owner changes remain prohibited; source session loses private-event access after transfer.
- Callback allows only internal return paths, uses canonical public origin (validated local Host only in development), exchanges/verifies the Google session and redeems ownership proof. Errors/cancellation have translated retry guidance without displaying provider errors, tokens or codes. Auth routes noindex/no-store and excluded from analytics. Client receives minimal account display data, never provider tokens.
- Added `docs/GOOGLE_AUTH.md`, server-only env placeholders and `scripts/setup-google-auth.mjs` (default dry-run; explicit `--apply`, existing redirect preservation, project-matched private management credential option). The script configures the Google provider and manual identity linking, then enables the local runtime flag. Google Cloud authorized redirect is `https://mgkocrlncpomhdaoxxqh.supabase.co/auth/v1/callback`.
- Verification: final production build, 22 unit tests and diff whitespace check passed. Live rollback-only SQL verified linked/new-account ownership, private/published posters, expiry/replay rejection, claim permissions, former-guest RLS denial and new-member editing. Bounded headless DOM checks verified three languages, disabled setup state, native focus/Escape, mobile bounds, safe callback errors and guest event access without screenshots. Owned QA server stopped; original port 3000 server left running.
- Pending: Google OAuth client credentials have not been supplied. Live provider and manual linking remain disabled; `GOOGLE_AUTH_ENABLED=false` locally. Actual Google consent/signup/login/logout and cross-browser OAuth end-to-end remain unverified until keys are configured. User was asked asynchronously to place `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in ignored `.env.local`; never send secrets in chat. Deployment still deferred.

## 2026-11-10 - Searchable modal URLs and multilingual SEO

- Kept the modal-first design and compatibility redirects; no standalone event detail page restored. Direct country `?event=ID` URLs now focus on one public event, server-render an open introduction dialog with an event H1 (readable without JavaScript), and carry their own title/description/canonical and stable poster URL. Expired events remain accessible but noindex. Closing the modal returns to discovery. Region chips became crawlable links with the existing styling; paginated listings keep independent canonical URLs. Internal search, empty/unknown region results and private/admin pages remain excluded.
- Added explicit `?lang=ko|en|zh-TW` versions and reciprocal canonical/hreflang/sitemap alternates. Proxy overwrites the internal locale header from an allowlisted URL parameter; explicit language takes priority over the preference cookie. Language selector preserves current event/filter/page parameters, map camera and form state. Client URL synchronization handles history navigation and stores the preference only after visiting, rather than during link prefetch. Event/source text is still original, not machine-translated.
- Added safe escaped JSON-LD for WebSite, collection ItemLists and breadcrumbs. Direct event documents emit Event data only with known dates and an address; no invented prices, ticket availability or organizer data. Shared cached explorer loader avoids duplicate metadata/render DB reads. Added default `/og` social PNG, SVG brand favicon and public `/images/events/ID` no-store redirect to renew short-lived Storage signatures without exposing private events.
- Sitemap now contains 100 current public base/region/event entries in the verified database, real update dates and language alternates; private/hidden/deleted/expired records omitted. Production canonical origin comes from validated public configuration or Vercel's production project domain, never arbitrary request hosts. Local builds/previews are noindex; previews also receive X-Robots-Tag. Added optional Google/Naver verification environment tokens and deployment/search submission instructions.
- Files: SEO helpers/shared explorer page, structured-data component, home/country/region routes, proxy/i18n/provider, modal/headings/filter links, sitemap/robots/site config, OG/image/favicon routes, CSS, env example, README and `scripts/seo.test.mjs`/test command. No DB schema/content writes or deployment.
- Verification: final production build and nineteen unit tests passed (canonical/alternate/page distinctions, safe/honest schema, stable image links, JSON-LD injection escaping, origin validation). Bounded headless browser with no screenshots verified explicit languages, event metadata/schema and one-event focus, modal language/close behavior, pagination/region links, search noindex, sitemap alternates, poster redirect, OG PNG, local robots and JavaScript-disabled event visibility; no page errors. Final language URL/history check preserved map/search and matched UI language. An initial dev QA attempt detected the user's existing server on port 3000 and left it untouched; used an owned production server on 3011 and stopped it. Initial region QA needed an explicit navigation wait; rerun passed.
- Still external: set the real public domain before deployment, supply ownership-verification tokens as needed, submit sitemap to Search Console/Naver and inspect live URLs. Public indexing/rich-result eligibility has not been verified against a live deployment and is not guaranteed by markup alone. Guidance consulted: Google Event structured-data, pagination, international URL/hreflang docs and Next.js metadata docs.

## 2026-11-10 - Private traffic and festival analytics

- Added first-party Supabase analytics and a password-protected `/admin/analytics` dashboard, independent of visitor signup/admin JWT roles. Dashboard supports 7/30/90-day browser visitors, sessions, page views, event views, daily chart/table, top twenty events, Korea/Taiwan exploration and referrer hosts, using Seoul dates. Twelve-hour signed HttpOnly admin cookie, timing-safe password comparison, attempt throttling and lock action; all UI translated into three languages.
- Applied `202611100004_analytics.sql` through the existing project MCP: RLS/revoked direct reads on hits/settings, indexed records, session/event unique index, public-event checks, key-protected ingest and aggregate RPCs. Generated independent server-only write/admin secrets in ignored `.env.local`, registered only the write-key hash in DB and documented deployment variables. No plaintext credentials printed, service-role key added or visitor signup introduced.
- Public page navigation tracker and actual introduction-modal opens collect asynchronously. Client suppresses language/refresh-of-components/reopen duplicates and serializes initial requests so identity cookies arrive before the next hit; DB enforces idempotent request IDs and one event per session. Browser cookie lasts one year; sessions expire after thirty minutes without hits. No raw IP/full URL/query/UA/account ID stored: HMAC browser/session hashes and referrer host only. Server allowlists/bounds payloads, checks same origin and applies per-instance rate limits. Localhost/Vercel previews, common bots, hidden pages and DNT/GPC are excluded. Not concurrent-user counting or verified humans.
- Files: analytics client/path/schema/server helpers, tracker, ingest route, dashboard/actions, modal/site chrome wiring, database types, CSS, i18n, env example, tests and README. Tracking stays outside registration/private/admin routes; visitor-facing poster/grid design unchanged. No advertising/deployment work performed.
- Verification: production build and sixteen unit tests passed. Live transaction verified request/event dedup, ignoring nonexistent/nonpublic targets, seven-day summary and anon rejection of raw reads/invalid-key RPCs; all fixture writes rolled back. Bounded headless browser (no screenshots) verified dashboard gate/login/lock, four metrics, seven-day range, language refresh, mobile bounds, exactly one page/event request despite modal reopen/language switch, local traffic exclusion and cross-origin rejection; no page errors. Browser telemetry was intercepted and never persisted. Temporary QA server stopped.
- Limits: counts are browser estimates and best-effort; filter-only changes are not new page views. Collection/password throttles are per process. Raw hit retention has no automated purge yet; review before substantial traffic. Admin password is available to the owner in `.env.local` as `ANALYTICS_ADMIN_PASSWORD`; localhost should show zero real traffic until public deployment (unless explicit local testing is enabled).

## 2026-11-10 - Korean, English and Traditional Chinese UI

- Added shared UI dictionaries and cookie-backed `ko`/`en`/`zh-TW` preference (default Korean). Root layout renders the selected HTML language/metadata on the server; client controls update immediately and refresh server content without navigating to a new URL. No translation API or dependency added, and user/source event titles, descriptions, venue/region names and addresses remain original content.
- Added compact global language selector plus selectors inside native create, cluster and event detail dialogs. Translated discovery/search, map hover links/controls, event modals, registration/address search, Tiptap labels/placeholder, private event management, reports, draft/error/not-found UI and known service notices. Known stored notices can be retranslated after a language switch.
- Kept the map translator callback stable so language changes do not rebuild WebGL/camera. Existing-event form hydration now keys on event ID rather than a new server object, preserving unsaved edits across refresh. Adjusted desktop/mobile selector placement away from catalog and masthead controls. Corrected admin event links to use their country.
- Files: `src/lib/i18n/*`, language provider/select, root layout, UI components/pages, CSS, `scripts/i18n.test.mjs`, package test command and README.
- Verification: final production build passed; all fourteen unit tests passed, including dictionary completeness/unique keys/interpolation, saved notices and untouched content (final dictionary additions rechecked). Bounded headless browser with mocked geocoding and no screenshots verified all three languages, map camera/search input preservation, registration text/location and editor labels, open modal/source content preservation, cookie reload, server-rendered private page and mobile width; no page errors. Final DOM bounds check verified no desktop/mobile selector/control overlap. No account/event writes or deployment. Temporary QA server stopped.
- Follow-up requested: GitHub-to-Vercel deployment and AdSense. Local branch is `main` with no Git remote configured; GitHub/Vercel CLIs were not available. No remote, push, deployment or ad script created. Official Vercel fair-use rules classify AdSense as commercial and require Pro/Enterprise rather than Hobby.

## 2026-11-10 - Taiwan discovery and registration

- Added `/taiwan`, home country selection with globe flight, shared country configuration and country-scoped poster lists/regions/markers. Home markers include both countries. Event modal links and legacy redirects resolve to the event's country; country pages reject mismatched event links. Kept Taiwan's page chrome as minimal as Korea and included Taiwan in sitemap/revalidation.
- Applied `202611100003_taiwan_events.sql` through the project-specific Supabase MCP: existing rows default to `kr`; country/location/timezone checks support Korea and Taiwan (including outlying Taiwan islands). Region view groups by country. Public-source ownership checks retain existing cases and add a restricted official Taiwan source/image/license case. RLS/anonymous ownership unchanged.
- Registration chooses Korea/Taiwan and defaults to the current country page. Country changes clear the old address/region/venue/coordinates. Geocoding filters and cache keys include country; client/server bounds and stored timezone agree. Source expiry follows each country's local date.
- Inserted six current official-source events with verified original image URLs, curated English introductions, dates/coordinates, OGDL-1.0/source attribution: Taiwan Open of Surfing, Taipei New Year's Eve, Pingtung Luoshanfeng Art, Xinshe Flower Carpet, Sun Moon Lake Fireworks Music Carnival and Maolin Butterfly Season. Source: https://data.gov.tw/en/datasets/7778, official daily activity ZIP. These are representative photos/posters, not necessarily edition-specific posters. No Korean events changed/deleted.
- `data/taiwan-events.json` and `scripts/import-taiwan.mjs` preserve the curated seed and verify images before optionally generating SQL; no automatic sync or service key added. Upserts preserve moderated publication states. Updated README, types and country validation tests.
- Verification: final production build, twelve unit tests and whitespace check passed. Bounded headless browser (no screenshots) verified animated Taiwan selection/center, six English cards, source/license and modal, Taiwan deep links/legacy redirect, form country default/reset/location gating, and 24 Korean cards with Korean links; no page errors. One live Taiwan geocoding request returned five valid results; reused it locally for form QA. No test accounts/events were written. Temporary QA server stopped.

## 2026-11-10 - Avoid automatic selection appearance in hover previews

- Disabled MapLibre popup `focusAfterOpen` for hover lists. Its default automatically focused the first link, making that row appear selected and keeping the popup open through the focus guard. Actual pointer hover and intentional keyboard focus retain their highlight.
- Verification: confirmed the library default and first-focusable behavior in installed source; TypeScript check passed. No browser run for this single-option fix.

## 2026-11-10 - Select events directly from map hover lists

- Map cluster/point previews now contain selectable event links opening the existing introduction modal. Grouped circular posters use the same interactive popup instead of a passive tooltip. Previews show up to eight titles and offer the complete group catalog when more events remain; marker clicks and touch catalog behavior are retained.
- A 350ms close delay bridges the pointer gap; hovering/focusing the popup keeps it open. Moving the map, Escape, switching markers and unmounting clear the preview/timer. Added orange row hover/focus states and loading/error feedback; no new dependencies or database changes.
- Files: `event-map.tsx`, `event-map-posters.tsx`, `globals.css`.
- Verification: production build and diff whitespace check passed. Bounded headless browser check verified cluster hover-to-list persistence, direct modal selection, grouped-poster hover selection, existing click catalog and mobile bounds; no page errors. Temporary QA server stopped. No event records were modified.

## 2026-11-10 - Tiptap introductions and clearer private saving

- Added lazily loaded Tiptap/StarterKit editor in registration step two: headings, bold/italic/underline, bullet/numbered lists, quote, HTTP(S) links, rule and undo/redo. Body limit is 20,000 plain-text characters. Formatting/content survives step changes; parent-echo synchronization cannot reset live editor selection/history. Over-limit or excessive-complexity content remains editable but cannot silently save an older valid snapshot.
- Applied `202611100002_rich_event_descriptions.sql` through the existing project-specific MCP launcher: nullable JSONB `description_content`, 20,000-character plain-text limit and a bounded JSON check. Updated typed records, save action and repository mapping. Server canonicalizes an allowlisted document and checks its derived text against submitted plain text. Rendered with small safe React components, without raw HTML or the editor runtime in read-only modals. Legacy plain text remains compatible; author view renders rich content too. No existing descriptions were rewritten.
- Renamed the action to ‘비공개로 저장’, updated success labels and added an entry to saved events in the registration dialog. This retains manual draft/private saving and the existing browser-based ownership model; it is not autosave. No login/cloud editor subscription or inline image upload added.
- Verification: final production build and eleven unit tests passed, including 20k limits, text/JSON consistency, malformed/unsafe links, unknown embed nodes and excessive nesting. Initial tests caught missing JSON breaking legacy plain forms; made it optional. An intermittent rapid-input browser check prompted echo-sync hardening; the complete final check passed: rich formatting/link/list, >5,000 characters, rejecting 20,001 before saving, step retention, private-save label, mobile bounds and formatted event modal without page errors. Geocoding/poster responses were mocked; no event/account fixtures were written. Live JSONB column verified after migration. Temporary QA server stopped.

## 2026-11-10 - Location-first registration and compact address UI

- New registration uses two steps: location first, then poster/title/required introduction/dates/optional link. Valid coordinates are required to advance, and address edits invalidate them. Controlled state retains poster and content on back/next; editing an existing event starts at the content step. Added accessible step navigation, heading focus and modal scroll reset.
- Consolidated address input and optional map into one compact card with icon search and a quiet country label. Removed duplicate success/status paragraphs; errors/coarse-location guidance remain. Retained small Geoapify/OSM attribution links according to provider guidance. Location picker is 220px desktop/200px mobile with no coordinate grid or HUD; explorer globe keeps both. Manual coordinate fields remain folded.
- Files: `event-form.tsx`, `address-search.tsx`, `event-map.tsx`, CSS, README. No database/API/dependency changes.
- Verification: final production build passed. Read-only browser with mocked geocoding and local tile/image fixtures verified location-first gating, stale-address rejection, poster/title/introduction preservation across steps, no redundant success messages, 220px map/no coordinate HUD and mobile bounds with no page errors. Initial check caught first-step inputs losing shared styling and overflowing mobile; extended the form input selectors and reran successfully. No API credits or database writes used for this check. Temporary QA server stopped.

## 2026-11-10 - Require introductions, make place labels optional

- Introduction is always visible and required (trimmed non-empty text, up to 3,000 characters), including form/server validation. Region, venue and official link are optional; address-derived labels may be edited/cleared. Coordinates remain required. Empty region saves use `unassigned` internally; empty region labels are omitted from chips, region directory, sitemap and modal facts.
- Applied `202611100001_event_form_requirements.sql` to the configured FESTIVA project through its existing local Supabase MCP launcher. Region/venue DB checks now accept empty strings and default to empty. A NOT VALID check requires descriptions on new/updated authored published events, preserving historical records and allowing imported public-source records without rewriting their descriptions. Old drafts with missing introductions get an actionable message when publishing.
- Files: form, event validation/actions, explorer, sitemap, event modal, SQL migration, validation tests and README. No existing event content was changed.
- Verification: inspected live constraint definitions/defaults after migration. Final production build and nine unit tests passed; browser confirmed visible required introduction, acceptance of a short sentence, optional blank region/venue/link and no page errors. No real event/account fixtures created. Temporary QA server stopped.

## 2026-11-10 - Address search and automatic event coordinates

- Added server-only Geoapify integration (`GEOAPIFY_API_KEY`, env example/local placeholder). User supplied the key; verified configured status without printing it. `/api/geocode` POST validates query/country, filters invalid or out-of-registration-range provider coordinates, maps at most five candidates, retains attribution, and has timeout, bounded cache and per-instance request limits. Provider URLs/keys/errors stay server-side.
- Registration now starts with country/address search before region/venue. Selecting a candidate fills address, coordinates and region, plus venue when empty. Editing the address invalidates stale coordinates. Map and numeric coordinate inputs are collapsed and lazily mounted; coarse results open the map for confirmation. Existing manual placement and draft/edit behavior remain. Korea-only registration matches existing DB/validation; no overseas schema migration was applied.
- Files: `address-search.tsx`, `event-form.tsx`, `lib/geocoding.ts`, `api/geocode/route.ts`, CSS, env example and README. Added normalization tests for malformed/foreign/out-of-bounds results, duplicates and precision. No dependency/database change.
- Verification: final production build and eight unit tests passed. Live provider queries returned Seoul City Hall and Busan BEXCO candidates. Browser confirmed live address search, selection mapping to 37.5667893/126.9784204, address edits clearing the point, lazy map/numeric confirmation, mobile width and invalid-query 400 with no page errors. Initial browser check found the internal Next request URL normalized to localhost, rejecting valid 127.0.0.1 Origins; switched same-origin checking to the Host header and reran successfully. OSM tiles intercepted locally during map check; no event/visitor creation. Temporary QA server stopped.

## 2026-11-09 - Keep events accessible beneath representative posters

- Circular posters now have orange count badges when representing multiple events. Hover shows up to five member titles rather than only the representative's facts. A single actual event still opens its introduction directly.
- Fixed collision handling: markers within the existing 64px poster spacing are merged into the visible representative's membership instead of skipped. Groups retain both cluster IDs and individual event IDs; clicking expands and deduplicates their complete memberships into the existing paginated catalog. Duplicate rendered tile features are ignored. Group-only hover no longer presents one representative's dates/location as shared group facts.
- Files: `event-map-posters.tsx`, `event-map.tsx`, `globals.css`, README. No new dependency, API or database changes.
- Verification: final production build passed. Read-only production browser confirmed a nine-event badge opened a nine-event catalog with nine cards, five hover titles, and introduction close returning to the catalog; no page errors. Temporary QA server stopped.

## 2026-11-09 - Browse clustered events without zooming

- Large orange cluster points now preview count and up to five titles on hover. Click/tap opens the complete cluster's poster catalog instead of automatically expanding the camera. Circular representative posters open that same catalog; individual posters still open event information. Applies on both home and country maps.
- Added `event-cluster-dialog.tsx`: native modal, 24-event pages using the existing bounded public poster endpoint, loading/error/retry, responsive grid, focus/scroll restoration, and nested event dialogs that return to the same catalog page. Cluster membership comes from MapLibre leaves (bounded by the existing 5,000-point map limit). Disabled EventCard route prefetch because primary interaction already has modal data. README updated.
- Verification: final production build passed. Read-only headless production check confirmed five hover previews, no camera movement on cluster click, next-page loading, event modal/Escape returning to catalog, representative-image group selection and mobile 366px bounds with no page errors. Initial check caught React cancel bubbling closing both dialogs; guarded the catalog cancel handler to handle only itself, and the complete rerun passed. Used one canvas capture for marker targeting; no repeated visual review or database writes. Temporary QA server stopped.

## 2026-11-09 - Full event information in explorer modals

- Removed standalone public event detail content. The former `/events/[id]/[slug]` route is a compatibility-only 308 redirect to `/korea?event=ID`; published-event links, creation/edit success navigation and map popup links now target/open explorer modals. Private author editing routes remain.
- The shared modal now contains the uncropped original image, dates, venue/address/region, introduction, status, official link, complete source/provider/license information and reporting. Desktop uses a wide two-column scrollable layout; mobile stacks image and content. Removed the detail-page link. Direct modal links are server-resolved with public visibility checks, close removes the event query, and sitemap excludes individual-event URLs. Proxy now handles session cookies only.
- Updated unit and integration expectations for the new URLs; old integration detail HTML/schema assertions no longer apply. README documents the behavior. No database changes.
- Verification: production build and all seven unit tests passed (updated the old URL expectation after its initial expected failure). Read-only production smoke checks passed. Headless check of the user's Pyeongchang link confirmed 308→explorer modal, image/facts/reporting, desktop 1040px/mobile 366px bounds, Escape clearing the query, card clicks staying on the map, sitemap exclusion and no page errors. Did not run the integration suite that creates database fixtures. Temporary QA server stopped.

## 2026-11-09 - Orange points and circular representative posters

- User corrected the marker direction: restored large constant-opacity markers, now orange with white outlines. Points do not fade on zoom. At zoom 6–7 a single 48px circular thumbnail appears over each eligible rendered marker. Clusters use their first leaf as the representative at the cluster's actual center; further zoom separates them. Hover/focus information and click/tap dialogs remain.
- Updated poster selection to use rendered cluster/point features rather than independent raw coordinates, retaining overlap spacing and the 36-poster cap. README updated.
- Verification: final production build passed. Headless production check confirmed no far-out posters, zoom reveal, 48×48 circular images, hover details, modal/Escape and hiding on zoom out, without page errors. Temporary QA server stopped.

## 2026-11-09 - Posters revealed by map zoom

- Replaced prominent bubble markers with small flat dots. At zoom 5.2–6.5, non-overlapping 44×62 poster thumbnails progressively appear at actual event coordinates. Hover/focus reveals title, venue/region and dates; click/tap opens the existing accessible introduction dialog. Zooming out hides posters. Globe, clustering, picker and right-hand catalog remain.
- Added `event-map-posters.tsx`, `/api/map-posters` and repository lookup: public/unexpired-source filtering, UUID validation, max 36 IDs/request, viewport selection/collision spacing, lazy image signing, abort/stale-response handling, bounded 128-event memory cache and 4-minute refresh on navigation. Images retain their aspect ratio. No schema/dependency changes.
- Verification: production build passed. Headless production check found eight visible posters, opacity increasing from 0.23 to 1 on zoom, hover info, modal open/Escape close and posters removed on zoom out. Invalid API IDs returned 400; no page errors. No repeated screenshots or real writes. Temporary QA server stopped.

## 2026-11-09 - White and blue interactive globe

- Replaced the separate d3 landing globe with the shared MapLibre globe projection. Home shows a responsive large sphere with blue latitude/longitude lines, pale land, country outlines and real event coordinates; country selection flies to Korea before routing. Korea exploration uses the same white/blue style and can zoom back to a sphere with the ◎ control. Existing poster panel, filters, clustering and event links remain.
- Restored geography from local Natural Earth world geometry without external explorer tiles. Adaptive grids cover the whole globe at low zoom, and coordinates follow camera movement. Simplified outlines do not gain street/building detail on zoom. Registration picker remains a raster location map, now in the light palette.
- Files: `event-map.tsx`, `globe.tsx`, home `page.tsx`, `globals.css`, README. No new dependency or database change.
- Verification: final production build passed. Headless production browser confirmed drag rotation, Korea flight/navigation, globe reset, mobile panel bounds/no horizontal overflow, zero external tile requests and no page/console errors. Inspected the final landing screenshot. An earlier browser script timed out because Korean selectors passed through PowerShell became question marks; replaced those test selectors and the final check passed. Temporary QA server stopped.

## 2026-11-09 - Fullscreen coordinate atlas

- Korea and region exploration now use a fullscreen coordinate grid with glowing event points, floating search/region controls and a collapsible poster panel. Mobile uses a horizontal poster rail at the bottom. Exploration no longer fetches external map tiles; the registration picker still uses real basemap tiles for location selection.
- Fixed MapLibre v6 worker loading in the Next.js bundle with `setWorkerUrl(new URL(..., import.meta.url))`. The earlier canvas/control-only checks did not detect worker failure; actual source rendering was confirmed during this change.
- Verification: final production build passed. Headless browser checked full viewport sizing, panel toggling, mobile rail bounds and zero external tile requests in exploration. Inspected the rendered desktop screenshot with visible grid and event points; confirmed the bundled worker returned 200 without worker errors. README updated.

## 2026-11-09 - Coordinate-focused map styling

- Restyled the interactive and registration maps with a dark, desaturated basemap, adaptive latitude/longitude grid, a live center-coordinate readout, and cyan event/pin markers. Zoom, clustering, picker interactions, and map attribution remain. Raster basemap labels remain faintly visible; no street data or location services were removed.
- Verification: production build passed; a local headless browser check confirmed the coordinate readout, zoom control and map pin selection. OSM requests were intercepted and fulfilled locally during the check. Visual styling was not inspected in a screenshot.

## 2026-11-09 - Interactive event and location maps

- Replaced the Korea explorer's static regional SVG with a MapLibre map: pan/zoom, clustered individual event coordinates, click-through event titles, and region-filter bounds. Fetches minimal public marker data independently of the 24-card pagination and applies the same region/search/expiry filters (bounded at 5,000 with a visible notice). Registration and editing use the same map to click or drag the location pin; direct coordinate entry and a static SVG fallback remain.
- Added runtime `/api/map-config`: defaults to OpenStreetMap standard raster tiles with attribution; `MAP_TILE_URL` and `MAP_TILE_ATTRIBUTION` allow a different HTTPS provider without rebuilding. Public OSM tiles are best-effort, have usage restrictions and no availability guarantee; choose an appropriate provider before significant production traffic. README documents this and the 5,000 marker limit.
- Verification: production build and seven unit tests passed. A headless browser check exercised map creation, zoom, attribution and location picking with all external OSM tile requests intercepted and replaced by a local image; no automated map traversal used the public tile servers. Region fitting was added after that browser check and verified by the final build. Existing coordinates are displayed as supplied; no address geocoding or coordinate correction was added.

## 2026-11-09 - Combine event registration fields

- Combined poster upload and event details into one form for the creation modal, direct editing, and legacy draft import. Preserved validation, image processing, anonymous publishing, saving, and location selection. Removed the unused staged-form behavior and unfinished OCR prompt from this flow.
- The user raised a global-coverage concern while Kakao Maps was being considered. No Kakao integration or environment variables were added. Keep the existing Korea SVG map and manual coordinates until the mapping and search providers are chosen; assess international coverage, Korean address quality, data storage and cost before integrating.
- Verification: production build and seven unit tests passed. No live event publication or new address-search API was tested. Next: decide the worldwide map/search architecture, then implement precise zoom, search, and pin placement.

## 2026-11-09 - Remove the standalone event creation route

- Removed `/events/new`; all create buttons now reuse the same modal, including the full site header, my events and legacy local-draft import. Legacy local drafts still open prefilled in place. Modified/new-tab links use `/?create=1` (with optional draft ID) and the masthead opens the modal and removes those transient parameters. Direct `/events/new` requests return 404.
- Updated smoke and integration test routes and removed the obsolete robots entry. Existing edit and cloud-draft routes remain intact.
- Verification: production build, seven unit tests and HTTP smoke tests passed. Headless browser checks passed opening a legacy draft without navigation, query fallback with prefilled data and cleared URL, and opening the modal from the header. Live database integration was not run.

## 2026-11-09 - Open event creation from the plus button

- The minimal masthead plus link opens the existing two-step event form in a native modal on both home and Korea pages. Normal link fallback and `/events/new` remain available. Publishing or saving a draft from the modal shows a completion state without navigating; optional links open the saved event or draft, and the current route refreshes. Closing is disabled during server submission.
- The dialog supports Escape/backdrop closing, focus restoration, background scroll lock, a scrollable mobile layout, and form-step scrolling inside the dialog. Existing direct-page and edit form submission behavior is unchanged.
- Files: `event-create-button.tsx`, `minimal-masthead.tsx`, `event-form.tsx`, `globals.css`.
- Verification: production build and seven unit tests passed. A local headless-browser check passed modal opening without navigation, poster upload, advancing to the information step, Escape close, and focus restoration. Live database submission was not exercised in this check.

## 2026-11-05 - Remove the slow paper animation

- User reported jank and unnatural motion in the production build and requested removal. Deleted the custom Canvas paper renderer and its preview script, uninstalled the added Playwright dev dependency, and restored a normal native event dialog with focus restoration, Escape/backdrop close, scroll lock, and the original event information and links.
- Investigated page-turn libraries without adding one. `grabfold` 0.1.0 supports a calendar binding and optional GPU curl, but is new, its WebGL renderer uses image textures, and its documentation notes single-page/back-face and accessibility limitations; confirm actual poster behavior and performance before considering it. `react-pageflip` supports HTML and bottom-corner turns but is primarily a book layout and must be assessed for the desired vertical standalone sheet.
- Verification: production build passed; no repeat visual capture, respecting the user's request to reduce verification overhead. Next step: evaluate a small isolated library prototype before integrating it into the event dialog.

## 2026-11-05 - Replace strips with a continuous corner lift

- Replaced the 24 DOM strips with a canvas-rendered, two-sided sheet. A diagonal curl begins at the bottom-right corner in the original card position; the sheet moves to a portrait details panel and returns along the same path. The back uses a rendered snapshot of the real semantic details, including scroll position on close. The source stays visible until the textures are ready; preparation failure and reduced motion use the normal accessible dialog.
- Kept Escape/backdrop/close behavior, focus restoration, image attribution and canonical links. Added resize handling and removed repeated copies of the details markup. Main files: `event-poster-dialog.tsx`, `event-card.tsx`, `paper-surface.ts`, `globals.css`.
- Added an optional standalone `scripts/preview-paper.mjs` and Playwright development dependency. Run `npx playwright install chromium` once, then `node scripts/preview-paper.mjs`; screenshots go to the OS temporary directory. `PLAYWRIGHT_EXECUTABLE_PATH` can select an installed Chromium.
- Verification: loaded the real Korea page in automated Chromium and inspected initial standalone curl frames. Corrected visible triangle seams in the renderer. TypeScript and final production build passed. The integrated animation was not visually rechecked after the user requested less verification/credit usage; further repeated capture was stopped.
- User preference: focus on implementation and keep repeated screenshots/verification concise.

## 2026-11-05 - Start the poster lift in place

- Synced sheet geometry and modal travel to one animation progress: the lower edge starts bending while the sheet stays aligned with the source card, then the sheet moves and grows toward the modal. Closing reverses the same path. The background darkens later and the close control fades in; the animated front image is fitted against the changing visible dimensions to match its original card.
- Files: `src/components/event-poster-dialog.tsx`, `src/app/globals.css`.
- Verification: production build and seven unit tests passed. Browser visual QA was not run; verify the perceived lift and continuity with the user on desktop and mobile.


## 2026-11-05 - Bend and turn the poster sheet

- Replaced the React Peel overlay after user feedback: its peel exposed a separate layer rather than turning the poster itself. The modal now animates a double-sided sheet made of 24 connected horizontal 3D strips; the lower edge turns first, the back carries the event content, and closing reverses the motion. Reduced-motion mode presents the final content directly. Removed the unused React Peel dependency.
- Files: `src/components/event-poster-dialog.tsx`, `src/app/globals.css`, package files.
- Verification: production build and seven unit tests passed. No browser visual verification was performed; assess the curvature, rendering performance and feel on desktop and mobile with the user.


## 2026-11-05 - Lift poster and reveal its back

- User clarified that the bottom edge should lift from the page and reveal the introduction on the physical back; closing should reverse to the original poster slot. Replaced the previous face-up crossfade with two genuine 3D faces, hinged X-axis rotation and vertical translation that keeps the finished back within the centered modal. The source poster is hidden while lifted and reappears at the end. Intro retains the image alongside event information, with a stacked mobile layout.
- Reduced-motion mode jumps to the visible back; close uses the reverse path and a matching delay. README reflects the final behavior.
- Verification: production build with TypeScript and `git diff --check` passed. Browser access host was unavailable in the prior check, so actual animation appearance and slot alignment still need visual review. No DB or deployment changes.

## 2026-11-05 - Lift poster without turning it over

- Replaced the 180-degree flip with an upper-edge-hinged lift: the lower edge rises toward the viewer, the card enlarges and settles face-up, and the poster surface fades into a larger view of the original image beside the event description. Closing reverses the movement. Geometry now aligns top edges to prevent a jump with the changed transform origin.
- Added a responsive image-and-description layout; on narrow screens the poster sits above the scrollable description. Original source image remains contained and attributed; reduced-motion mode displays the result directly. Updated README wording.
- Verification: production build including TypeScript and `git diff --check` passed. The browser access host was unavailable in the previous check, so movement and mobile layout have not been visually verified. No database or deployment changes.

## 2026-11-05 - Larger bottom-up poster flip

- Changed poster modal animation from a sideways Y-axis turn to a bottom-up X-axis flip: the lower edge comes forward as the poster moves to the center, and closing reverses the motion. Slowed the transition and adjusted perspective for a paper-like movement; reduced-motion mode shows the back directly.
- Increased the modal to up to 760 × 820 px, nearly full-screen on small phones, and enlarged detail typography. Close delay matches the longer reverse animation.
- Verification: production build including TypeScript passed. Browser visual QA remains unavailable because the browser access host was unavailable in the preceding check; actual animation appearance still needs a browser review. No DB or deployment changes.

## 2026-11-05 - Flipping poster details modal

- Public `EventCard` links now intercept ordinary in-app activation to open a native modal: the selected poster moves from its screen position to a centered card, flips to reveal event title, date, venue, description, source/license attribution and official/detail links, then reverses on close. Ctrl/Cmd/shift/alt clicks keep normal link behavior; canonical detail URLs remain server-rendered and indexable.
- Added `EventPosterDialog` using native `showModal`, keyboard focus, Escape/backdrop/close controls, focus restoration, background scroll lock, mobile scrolling and reduced-motion handling. User-created draft/management cards are unchanged. TourAPI image is displayed unmodified and source attribution remains visible.
- Verification: production build/TypeScript, seven unit tests, smoke routes, and real public event search/SSR-link/direct-detail/JSON-LD HTTP checks passed. CUA reported browser access host unavailable, so animation playback, focus interaction and responsive visuals could not be visually tested. No DB or deployment changes.

## 2026-11-05 - TourAPI replacement with official event images

- User asked to replace the previously imported public events with TourAPI and required images; user later suggested AI-generated alternatives for missing images. The configured key was actually URL-encoded, so the importer accepts both Encoding and Decoding keys without logging them. TourAPI returned 111 ongoing/upcoming records; all 111 had an available official image, so no AI image was generated or needed. The importer currently skips records without an accessible, licensed source image; AI fallback is not implemented.
- Applied `202611050003_tourapi_images.sql`: TourAPI sources have immutable numeric content IDs, mandatory HTTPS image URLs constrained to `tong.visitkorea.or.kr`, and required Type1/Type3 rights metadata. Non-visitor rows remain uneditable/unforgeable by ordinary clients; user submissions retain verified poster requirement. `event-repository` displays the original unmodified official image; card/detail alt text calls it a representative image, not necessarily a poster. Detail attributes source, provider and license; source images use contain with no crop/hover zoom.
- Created `scripts/import-tourapi.mjs` / `npm run import:tourapi`. Defaults to read-only, uses official paginated search plus detail calls, normalizes both key forms, checks date/location/rights and verifies each image response before import, and updates by stable content ID without restoring hidden/deleted records. `--apply --replace-standard` verified the 111 new records through public RLS before soft-deleting 64 old national-standard imports; it targets only that source, preserving visitors, reports and user-created events. Legacy importer writes are disabled to prevent accidental republishing. Historical source rows remain recoverable; no automatic schedule is configured.
- Live DB check: 111 published TourAPI events, 111 image URLs and 111 unique IDs; all 64 prior source rows are deleted/unpublished. Original images may be photos and remain hosted by the provider, so future availability depends on that service. Source API supplies Type3 images (attribution, no changes); no edits/transcoding were applied. The API quota is consumed by list/detail calls; avoid repeated dry runs unnecessarily.
- Verification: three dry runs and the actual import verified all 111 image responses; production build/TypeScript, seven unit tests, smoke and full live integration passed. Integration included visitor source-forgery/foreign-edit denial, service-role rejection of missing/off-host TourAPI images, past-event filtering, user poster requirements, moderation, reporting and fixture cleanup. Real search/detail/sitemap and sample official image response passed. `.env.local` remains ignored. Browser host was previously unavailable; no visual QA. README documents operation, source limitations and lack of automatic/AI fallback.

## 2026-11-05 - TourAPI environment placeholder

- Added the blank server-only `TOUR_API_SERVICE_KEY` setting to `.env.example` and the ignored local `.env.local`, preserving existing settings. README explains obtaining the data.go.kr Decoding key, setting it only in server environments, and restarting the server.
- Verification: confirmed `.env.local` is Git-ignored. No key was supplied, and TourAPI calls, poster matching and collection have not yet been implemented or verified.

## 2026-11-05 - Imported national public festival data

- Downloaded the official public-data portal's 전국문화축제표준데이터 (dataset 15013104) through its own download metadata/JSON endpoints; no third-party scraping or API key. Of 1,372 official rows, 75 were ongoing/upcoming in Korea time, and 64 remained after excluding invalid/missing coordinates and conservative title/start-date/venue duplicates. Inserted and publicly verified 64 events in the dedicated FESTIVA Supabase project; all have source/reference dates. There are 15 public region filters. All test fixtures/visitors were removed after verification.
- Applied `202611050001_public_festival_sources.sql` and `202611050002_hide_past_source_regions.sql` through the existing scoped official Supabase MCP. Imported events have no visitor author or poster, source metadata, unique fingerprint, and a DB-guarded owner/source distinction. Visitor-authored events still require an owned stored poster before publication; authenticated clients cannot forge or modify source records. Security-definer trigger EXECUTE remains revoked from anon/authenticated.
- Added `scripts/import-festivals.mjs` / `npm run import:festivals`: dry-run by default, explicit service key plus matching project ref for writes, strict metadata/completeness/date/coordinate checks, dedupe and province grouping, preserves hidden/deleted state on refresh. A repeated live import added zero records and refreshed 64. Source has no stable row ID: changes to title/start/venue may produce a new row, and absent upstream rows are not deleted. No scheduled sync is configured; manual rerun is needed for additions/changes. Imported events that end are excluded automatically from explorer, source region view and sitemap in Seoul time; direct detail remains accessible.
- Added source/provider/reference date on details, no-image fallback, live data in lists/regions/sitemap, and minimal chrome on region pages. Public-data dates/coordinates are supplied by the provider and may be stale; users are directed to official information. This dataset does not include poster images. `README.md` documents manual operation and credentials handling.
- Verification: production build/TypeScript, seven unit tests, smoke tests, repeat import, public HTTP search/region/detail/source/placeholder/sitemap checks, and full live integration including forged-source denial, expired-source exclusion, poster/owner safeguards, reports and cleanup passed. One initial expiry assertion incorrectly matched the search term echoed in the input; changed it to inspect the event ID and reran successfully. SQL confirmed 64 published source records, 0 fixture events/visitors, and no API-role trigger EXECUTE. Browser visual QA was not run because the browser host was unavailable in prior attempts. Site deployment and automatic periodic collection remain to be set up.

## 2026-11-04 - Homepage country selector

- Added a centered native country select below the festiva masthead and above the globe. Currently offers 대한민국, the only implemented country route. Selection invokes the same fullscreen globe zoom as the Korea marker, with direct navigation fallback if canvas initialization fails. Country selector fades alongside the masthead during zoom.
- Reduced responsive globe bounds to accommodate the selector within the initial viewport and added visible keyboard focus for selects.
- Files: `src/components/globe.tsx`, `src/app/globals.css`. Verification: production build including TypeScript passed; browser playback remains unverified due to the previously unavailable browser host. No deployment or database changes.

## 2026-11-04 - Full viewport globe zoom

- Korea navigation now promotes the globe canvas to a fixed viewport overlay during the 850ms zoom instead of clipping drawing at the homepage globe box. Captures the existing screen center/radius before promotion to avoid a first-frame jump; rotates toward Korea, interpolates to the viewport center and scales far enough to cover the viewport, including wide screens. Masthead fades during transition, while the globe wrapper keeps its layout space.
- Reduced-motion navigation still skips animation. ResizeObserver updates overlay resolution on viewport changes; animation and overlay classes are cleaned on unmount. Existing destination reveal and ordinary/modified link navigation remain.
- Also retained the user's restored decorative marks and icon-only search button from the preceding small visual edits.
- Files: `src/components/globe.tsx`, `src/app/globals.css`. Verification: production build including TypeScript passed. Browser host was unavailable in the previous check; animation playback/fullscreen visual QA remains unverified. No deployment or database changes.

## 2026-11-04 - Centered Korea explorer and globe transition

- Shared centered `MinimalMasthead` (festiva and icon-only upload link) between `/` and `/korea`; Korea adds a round home/back link. Both omit the old shared menu/footer. Other routes retain existing chrome.
- Korea order: centered search, SOUTH KOREA / 대한민국, centered region filters, equal-width map/event columns (also retained on narrow screens; event cards become one column). Removed result headings/counts, subtitle, map help and empty-state actions/descriptions; empty results show only the requested message. Pagination remains available only when needed.
- Korea marker now rotates toward Korea and zooms the actual orthographic projection over 700ms before navigation, with a subtle destination reveal. Honors reduced-motion preferences, cancels animation on unmount, prevents duplicate navigation, and preserves ordinary link behavior for modifier clicks. Map input help remains enabled in event registration.
- Verification: production build/TypeScript, smoke routes, focused HTTP checks for home/Korea/query/region markup and unchanged registration chrome, and `git diff --check` passed. CUA browser host unavailable; visual alignment and animation playback remain unverified. No deployment or database changes.

## 2026-11-04 - Minimal globe homepage

- Replaced the home hero, explanations, event cards and invitation with a centered festiva wordmark, accessible icon-only registration link and large responsive globe. Removed the home database query; `/` now prerenders statically.
- Added pathname-aware `SiteChrome` so home omits the shared header/footer while internal routes keep navigation and footer on initial render and client navigation. Globe keeps drag/keyboard rotation; a projected, keyboard-accessible Korea marker links to `/korea` and hides on the far hemisphere. Removed the normal visible globe caption.
- Files: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/site-chrome.tsx`, `src/components/globe.tsx`.
- Verification: production build (including TypeScript) and `git diff --check` passed. Production HTTP checks passed for minimal home markup, registration/exploration links, internal-route chrome and registration availability. Browser host unavailable, so visual/mobile/click QA remains unverified. No deployment performed; changes are in the local Next.js project.

## 2026-11-04 - Connected no-signup Supabase event workflows

- Product behavior: anyone can register without signup, email, password or SMTP. Anonymous visitor identity is created lazily on the first write and stored in cookies; author management is limited to that browser. Browser-side session creation uses a cross-tab lock and preserves Supabase's IP rate limit. Server actions verify the visitor and retain a no-JS-transport fallback. No public login/signup/logout routes remain.
- Applied five migrations under `supabase/migrations/`: final tables `visitors`, `events`, `event_images`, `reports`, `extraction_jobs`; `event_regions` is a security-invoker view. Enabled RLS everywhere, owner-only draft/edit policies, public published reads, immutable event identities, admin-only moderation, unique reports and server-only AI writes. Supabase anonymous sessions enabled; email verification was not disabled and no custom SMTP/email template was configured.
- Created private `event-posters` bucket (JPG, <=10MB). Upload paths are visitor/event scoped, image links must reference an uploaded file owned by the author, and publication requires a real poster. App resizes uploads, validates server-side file signature/fields, replaces old files and issues 5-minute signed URLs. Previously issued image URLs/cached content can outlive unpublication until expiry. Deletes are soft deletes.
- Connected home/search/pagination/region pages/public detail/sitemap and my-event create/edit/preview/publish/unpublish/delete to the real database. Added report submission and privileged `/admin` controls. No administrator visitor was assigned persistently. Public concept samples and unused SVG posters removed. Legacy local drafts remain available at `/me/local-drafts` and can be imported via the registration form.
- Added generated Supabase types, Zod validation, cookie refresh in the request proxy, Korean route decoding/canonical redirects and conditional Event JSON-LD. Removed global streaming loading boundary so missing/private records return actual 404 responses. Removed obsolete signup UI code. AI extraction remains intentionally unconnected.
- Permissions: security review found default API-role EXECUTE grants survived the initial PUBLIC revoke; migration 005 explicitly revoked anon/authenticated access to all three SECURITY DEFINER trigger functions. SQL verified those privileges false. Anonymous-policy advisories are expected for the requested no-signup product; do not disable anonymous access to silence them.
- Verification: final `npm run build`, `npm run typecheck`, seven `npm test` cases, `npm run check:supabase`, `npm run test:smoke` and `npm run test:integration` passed. Live integration exercised multipart server actions, automatic visitor cookies, isolated drafts, foreign edits/identity/path/MIME rejection, real poster reads, publication, SSR/JSON-LD/search/region/sitemap, Korean URLs, image replacement metadata cleanup, unpublication, reporting/deduplication/privacy, role escalation prevention, admin hiding and soft deletion. All synthetic users/events/files were cleaned. A SQL check confirmed no fixture rows/objects remained before the last successful repeat; final repeat cleanup also succeeded.
- Verification limit: CUA browser host remains unavailable; no visual/click/mobile QA. The live HTTP/DB tests cover the complete server workflows. Final local test server stopped after verification. README documents operation, anonymous ownership limitations and live-test credentials (never stored in the repository).
- Next: actual poster AI extraction, optional recoverable edit links if cross-device editing is desired, visual QA and hosting/domain setup. Public deployment and real event seeding were not performed.

## 2026-11-04 - Removed obsolete prototype files

- Moved the entire obsolete `dist/` prototype (19 files: old HTML/JS/CSS, vendored scripts/licenses, duplicate maps/posters and unused JPGs), workspace-root `festiva-release.tar.gz`, `.next/` and `tsconfig.tsbuildinfo` to the Windows Recycle Bin. Verified exact absolute targets were inside the workspace and were not reparse points. Initial recursive permanent-delete command was blocked by execution policy; used recoverable recycling instead.
- Kept the Next.js source, active `public/assets/`, dependencies/lockfile, tests, `.env.local`, Supabase clients and external MCP credentials. No remote services, browser draft data or deployed versions were changed.
- Removed the stale static `dist` deployment target from `.openai/hosting.json` while preserving its existing Sites identity. Updated README and TypeScript exclusions; added `dist/` to ignore rules to prevent reintroducing generated legacy output.
- Verification: no live-source references to removed assets/paths; clean `npm run build` (including TypeScript), `npm test` (4 cases), `npm run test:smoke`, `npm run check:supabase` and `git diff --check` passed. Build/type caches were regenerated by validation and remain ignored. Local smoke-test server stopped after verification.

## 2026-11-04 - FESTIVA Supabase and MCP bootstrap completed

- Explicit user approval: pause `jjak-gido` to free a slot. Verified target identity before POST pause; confirmed it reached INACTIVE. No data deletion, billing upgrade or changes to the other existing projects.
- Created dedicated Free project `festiva`, ref `mgkocrlncpomhdaoxxqh`, region `ap-northeast-2` (Seoul), ACTIVE_HEALTHY. Database password is stored only in the user-local provisioning record outside the repository.
- App: wrote ignored `.env.local` with the project URL and publishable key only. Added `@supabase/supabase-js`, `@supabase/ssr`, browser/server config helpers in `src/lib/supabase/` and `npm run check:supabase`. No tables, buckets, sign-in flow or public submission behavior have been implemented; local drafts remain local. Future auth requires proxy session refresh.
- MCP: registered `supabase_festiva` in user Codex configuration. Remote HTTP initialize was blocked by Cloudflare 1010; replaced it with the official stdio package 0.15.0 installed under user `.codex/tools/supabase-festiva`. Scope is the FESTIVA project, feature groups database/docs/development/debugging. Private credential is outside the repository and command arguments; no token retained in the MCP config itself.
- Verification: official SDK client completed MCP handshake, listed 11 tools, called `get_project_url` and `list_tables` successfully (empty public schema). Auth settings + SDK initialization + public Data API authentication passed; API-root OpenAPI requires a secret key, so the app check probes the ordinary events endpoint instead and treats PGRST205 as the expected uncreated-table bootstrap state.
- `npm run build` and four `npm test` cases passed. `.env.local` confirmed ignored by Git. Current conversation has no hot-loaded Supabase tools; restart/reopen the app/session to load the saved MCP. Next work: event schema/RLS/storage, login/session refresh, then replace local registration with shared persistence.

## 2026-11-04 - Dedicated Supabase project creation attempted

- User approved creating a separate FESTIVA Supabase project. Existing Management API authentication was verified without copying credentials into this repository.
- Organization plan is Free; Seoul (`ap-northeast-2`) is available. Requested project name `festiva` with the smallest default instance and a generated database password.
- Supabase rejected creation with HTTP 400: organization owner has reached the two-active-free-project limit. No FESTIVA project was created. Existing projects, billing, data and pause states were not changed.
- Current account projects: `jjak-gido` active, `church-checker` coming up, `lukeMCP` inactive. Pausing an already inactive project would not free a slot.
- Next: User must identify an existing active project that may be paused, or explicitly choose a paid-plan path. Then create FESTIVA, verify readiness, configure app credentials and project-scoped MCP. Supabase plugin connection remains unconfirmed; no Supabase tools are exposed in this chat.

## 2026-11-04 - Next.js frontend foundation

- Summary: Added Next.js 16.4.5 / React 19.3.1 / TypeScript App Router at the repository root. Preserved the original `dist/` prototype and existing Sites identity/configuration; no deployment or backend changes.
- UI: React Canvas globe, Korea SVG map, search/region filters, linked region/event detail pages, poster-first registration, local draft preview/edit/delete, responsive layout, loading/error/404 states. Real AI extraction, authentication, shared persistence and publishing remain explicitly unavailable in the UI.
- Data: `src/lib/events.ts` defines event types and four clearly marked illustrative samples with no fabricated dates. `src/lib/drafts.ts` uses a new `festiva-event-drafts-v2` key, compresses uploads to max 1200px JPEG, handles storage failures and leaves legacy browser data untouched.
- SEO: Server-rendered event content, canonical metadata and pre-render redirects via `src/proxy.ts`, robots/sitemap. Samples are noindex and excluded from sitemap; verified real data and conditional Event structured data are future work. Set `NEXT_PUBLIC_SITE_URL` before public deployment.
- Key files: package/lock/TypeScript/Next config, `src/app/`, `src/components/`, `src/lib/`, `src/proxy.ts`, `public/assets/`, `scripts/`, `.env.example`, README.
- Verification: `npm run build`, `npm run typecheck`, `npm run test:smoke` and `npm test` (4 storage/upload validation cases) passed. Smoke checks cover production routes/assets, server HTML, canonical redirects, sample noindex, invalid-route 404 and sitemap exclusions. Geographic bounds/projection were also checked against the Korea data.
- Verification limit: Browser access host unavailable; Windows fallback repeatedly rejected the current Whale window binding. No visual, mobile viewport, pointer or upload/save UI verification was completed. Initial uncached page-render redirect returned a duplicated Location through fetch; moving redirects to the request proxy resolved the production smoke check.
- Next: Browser QA, Supabase Auth/Database/Storage, server-only extraction API, venue search, real verified events and Next.js-compatible hosting. The existing `.openai/hosting.json` still serves only the legacy `dist/`, as documented.

## 2026-10-21 - Edge-to-edge posters and flipping detail

- Summary: Added a white/blue visual theme, edge-to-edge portrait poster grid, hover/focus title overlays and native title tooltip. Poster selection animates a front/back card from its source bounds into a centered dialog; the final view contains only festival name and description plus close control. Escape/backdrop dismissal and reduced-motion fallback are retained.
- Registration: Header add action now enters map location selection (land click or existing region marker), then opens a single-image/name/description form. Coordinates are derived from the SVG map transform, not typed. Local storage and the existing records are preserved; no Supabase connection or shared edits are implemented.
- Assets: Four clearly labeled FESTIVA concept/sample SVG posters replace illustrative photos in seed cards; not official festival artwork.
- Verification: Browser verified blue globe, zero grid gap, text-only dialog with zero images/links after flip, map-marker click/keyboard filtering, location-first registration form, and 390px mobile dialog. Node syntax and static form/asset checks passed. Images after upload still use the existing JPEG compression implementation.
- Notes: Server storage/login and collaborative editing require the future Supabase integration. Detail deliberately omits the previous local delete action to respect the name/description-only design. Existing stored records still load.

## 2026-10-21 - Korea-first minimal explorer

- Summary: Replaced the globe.gl/WebGL UI with a Canvas orthographic globe using d3-geo; home has only branding, add button, search, globe. Korea selection animates into a left SVG map and right thumbnail/name grid. Added local festival registration, photo resizing, search, region selection, detail and deletion.
- Performance: Initial HTML/CSS/JS/world data is 237,211 bytes uncompressed. Removed 1.77MB globe.gl bundle and 488KB country source from deployment. Vendored d3-array + d3-geo total 53,533 bytes; compact world data 149,482 bytes. Korea geometry (5,997 bytes), festival records and local thumbnails load only on entry. No external font or runtime CDN requests; drawing runs only on input/transition/resize, DPR capped at 1.75.
- Verification: Local HTTP 200; Node syntax and geographic hit/inverse-coordinate, asset, sanitization and search checks passed. Browser verified desktop globe, Korea grid, detail modal, search, registration, reload persistence, deletion and keyboard region selection. Mobile 390x844 layout inspected; fixed collapsed map margins. Added transparent pin hit areas after mouse selection inspection; final pointer change covered by source review, browser session ended before recheck.
- Notes: Registration is browser-local only, explicitly disclosed; no shared backend. Four Korean demo festivals retain typical months and illustrative photos. World geometry Natural Earth 110m; Korea Natural Earth 50m from https://github.com/nvkelso/natural-earth-vector . d3 licenses included. Previous bookmark data is untouched but no longer surfaced in minimal UI.

## 2026-10-21 - FESTIVA globe festival explorer

- Summary: Built a Korean responsive festival explorer with an interactive globe, clickable Natural Earth country boundaries, animated country/region focus, georeferenced region pins, thumbnail cards, detail dialogs, month/theme filters, and browser-local bookmarks.
- Files: dist/index.html, dist/style.css, dist/app.js, dist/assets/*, .openai/hosting.json.
- Verification: Node syntax check passed. Data/filter checks passed for 18 unique festivals, coordinate bounds, country/region/month/theme and saved views. Local HTTP returned 200. In-app browser timed out; visual/WebGL/animation QA remains unverified.
- Notes: Prototype uses representative venue coordinates, typical months, and illustrative Unsplash photos, explicitly disclosed in UI. No live festival feed, verified yearly schedules, accounts, or backend. globe.gl 2.45.0 and Natural Earth geometry are vendored. Google Fonts and images need internet access. Primary globe.gl API reference: https://github.com/vasturiano/globe.gl .
