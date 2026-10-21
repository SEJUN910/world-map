# FESTIVA

한국 축제 지도와 포스터 탐색 프로토타입. Buildless static site.

Run `python -m http.server 4175 --directory dist` and visit http://localhost:4175 .

Home shows a draggable Canvas globe on white, with blue oceans, white land and orange Korea highlight. Korea opens a coordinate-based SVG map and tightly packed portrait posters. Hover/focus shows a title; selecting a poster flips it into a centered text-only name/description dialog. Native dialog supports Escape, close and backdrop dismissal; reduced motion skips the flight.

Registration: select a location on the map, upload one JPEG/PNG/WebP poster, enter name and description. The image is resized locally to an 800px maximum edge and compressed as JPEG. Records are stored only in the current browser. No Supabase backend, authentication, shared submissions or edit approvals are connected yet.

Seed poster SVGs are FESTIVA sample/concept artwork, not official festival posters. Four Korean seed descriptions are illustrative, not a confirmed annual calendar.

Rendering uses vendored d3-array 3.2.4 and d3-geo 3.1.1 (licenses in assets). Natural Earth 110m globe boundaries and 50m Korea outline. No external font or runtime CDN; geographic data and posters are loaded only when needed. No continuous idle drawing loop.
