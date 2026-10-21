# FESTIVA

지도에서 발견하는 세계 축제. Buildless static prototype.

## Local preview

Run `python -m http.server 4173 --directory dist` from this directory and visit http://localhost:4173 .

## Data

`dist/app.js` contains the demo festival dataset. Each record includes a stable ID, ISO country code, region, representative venue latitude/longitude, typical month, theme, descriptive text, official reference URL, and illustrative photo ID. Dates are not a verified annual calendar. Images are illustrative, not documentary festival photos.

Country boundaries: Natural Earth, distributed in the globe.gl example dataset. globe.gl: https://github.com/vasturiano/globe.gl (MIT). Refer to its upstream license. No dependency installation or build is needed.

Use a real festival data source with verified event dates and precise venue coordinates before presenting this as a current travel calendar. Browser-local bookmarks do not sync across devices.
