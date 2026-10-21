# FESTIVA

한국의 축제를 발견하는 초간단 지도. Buildless static site.

Run `python -m http.server 4174 --directory dist` and open http://localhost:4174 .

- Home: draggable Canvas globe, brand/add action at top left and search at top right.
- Korea: SVG map using geographic coordinates, selectable region markers, thumbnail/name grid and detail dialogs. Mobile stacks map and grid.
- Registration: optional photo resized to 800px JPEG; name, region, typical month, venue and coordinates; optional introduction and official URL. Records stay in localStorage in the current browser. Storage failures preserve the form. Deletion is available for locally created entries.
- Four seed festivals in `dist/assets/festivals.json` are demo records with illustrative photographs and typical months, not confirmed annual schedules. Replace with verified data and cleared imagery for launch.
- Rendering: d3-array 3.2.4 and d3-geo 3.1.1, local vendored files and licenses. Natural Earth 110m globe boundaries with compact coordinates; Natural Earth 50m Korea outline. No build or runtime CDN required.
- About 237KB initial source bytes before compression; Korea data and photos are deferred until entry. No continuous idle render loop. Supports reduced motion.

A shared database, synchronized registration and verified annual festival data are not implemented.
