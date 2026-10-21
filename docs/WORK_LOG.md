# Work Log

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
