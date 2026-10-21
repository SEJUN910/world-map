# Work Log

## 2026-10-21 - FESTIVA globe festival explorer

- Summary: Built a Korean responsive festival explorer with an interactive globe, clickable Natural Earth country boundaries, animated country/region focus, georeferenced region pins, thumbnail cards, detail dialogs, month/theme filters, and browser-local bookmarks.
- Files: dist/index.html, dist/style.css, dist/app.js, dist/assets/*, .openai/hosting.json.
- Verification: Node syntax check passed. Data/filter checks passed for 18 unique festivals, coordinate bounds, country/region/month/theme and saved views. Local HTTP returned 200. In-app browser timed out; visual/WebGL/animation QA remains unverified.
- Notes: Prototype uses representative venue coordinates, typical months, and illustrative Unsplash photos, explicitly disclosed in UI. No live festival feed, verified yearly schedules, accounts, or backend. globe.gl 2.45.0 and Natural Earth geometry are vendored. Google Fonts and images need internet access. Primary globe.gl API reference: https://github.com/vasturiano/globe.gl .
