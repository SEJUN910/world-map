// Detailed basemap for the event maps: OpenFreeMap vector tiles (free, no key,
// OpenMapTiles schema) drawn in a light, low-saturation style so the orange
// event markers and posters stay on top visually. The globe keeps the local
// world.json below zoom 4; the basemap fades in between zoom 4 and 5.
import type { ExpressionSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { Locale } from "./i18n";

export const OPENFREEMAP_ORIGIN = "https://tiles.openfreemap.org";
export const BASEMAP_SOURCE = "basemap-vector";
export const BASEMAP_GLYPHS = `${OPENFREEMAP_ORIGIN}/fonts/{fontstack}/{range}.pbf`;
// Hangul and CJK ideographs are drawn with the device's fonts, so they never
// depend on remote glyph ranges (which would also be large).
export const LOCAL_IDEOGRAPH_FONTS = "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', sans-serif";
/** The world.json land, grid and background give way to the basemap over this zoom range. */
export const BASEMAP_FADE: [number, number] = [4, 5];
/** On the home globe the basemap is attached only once the user zooms this far in. */
export const BASEMAP_ATTACH_ZOOM = 3.5;

export const basemapSource: SourceSpecification = {
  type: "vector",
  url: `${OPENFREEMAP_ORIGIN}/planet`,
  attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>',
};

/** Place names in the UI language, falling back to the local name. */
export function labelField(locale: Locale): ExpressionSpecification {
  if (locale === "en") return ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
  if (locale === "zh-TW") return ["coalesce", ["get", "name:zh-Hant"], ["get", "name:zh"], ["get", "name"]];
  return ["coalesce", ["get", "name:ko"], ["get", "name"]];
}

/** 0 → `to` over the fade range, so the basemap appears as the world.json globe disappears. */
export function fadeIn(to = 1): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], BASEMAP_FADE[0], 0, BASEMAP_FADE[1], to];
}
/** `from` → `to` (default 0) over the fade range, for the world.json land, grid and country fill. */
export function fadeOut(from: number, to = 0): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], BASEMAP_FADE[0], from, BASEMAP_FADE[1], to];
}
/** Land colour: white globe → light grey detailed land, so white roads read. */
export const BASEMAP_BACKGROUND: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], BASEMAP_FADE[0], "#ffffff", BASEMAP_FADE[1], "#f2f3f5"];

const source = BASEMAP_SOURCE;
// Opacity 0 still downloads tiles; a minzoom keeps the zoomed-out globe from fetching any.
const minzoom = BASEMAP_FADE[0];
const regular = ["Noto Sans Regular"];
const bold = ["Noto Sans Bold"];
const halo = { "text-halo-color": "#ffffff", "text-halo-width": 1.5 } as const;
const majorRoads: ExpressionSpecification = ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary"], true, false];
const width = (stops: number[]): ExpressionSpecification => ["interpolate", ["exponential", 1.4], ["zoom"], ...stops];

/** Symbol layers whose text follows the UI language. */
export const BASEMAP_LABEL_LAYERS = ["basemap-water-name", "basemap-road-name", "basemap-place-state", "basemap-place-country", "basemap-place-city", "basemap-place-town", "basemap-place-local"];

export function basemapLayers(locale: Locale): LayerSpecification[] {
  const text = labelField(locale);
  return [
    { id: "basemap-landcover", type: "fill", source, "source-layer": "landcover", minzoom, filter: ["match", ["get", "class"], ["wood", "grass", "farmland"], true, false], paint: { "fill-color": "#e9f1e4", "fill-opacity": fadeIn(0.7) } },
    { id: "basemap-park", type: "fill", source, "source-layer": "park", minzoom, paint: { "fill-color": "#e2efdc", "fill-opacity": fadeIn() } },
    { id: "basemap-water", type: "fill", source, "source-layer": "water", minzoom, paint: { "fill-color": "#cfe2f7", "fill-opacity": fadeIn() } },
    { id: "basemap-waterway", type: "line", source, "source-layer": "waterway", minzoom: 8, paint: { "line-color": "#cfe2f7", "line-width": width([8, 0.5, 14, 3]), "line-opacity": fadeIn() } },
    { id: "basemap-building", type: "fill", source, "source-layer": "building", minzoom: 14, paint: { "fill-color": "#e6e8ec", "fill-outline-color": "#d9dce2", "fill-opacity": fadeIn() } },
    { id: "basemap-boundary-state", type: "line", source, "source-layer": "boundary", minzoom, filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]], paint: { "line-color": "#a3adbd", "line-width": width([5, 0.6, 12, 1.4]), "line-dasharray": [3, 2], "line-opacity": fadeIn() } },
    { id: "basemap-boundary-country", type: "line", source, "source-layer": "boundary", minzoom, filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]], paint: { "line-color": "#7d8798", "line-width": width([4, 0.8, 12, 2]), "line-opacity": fadeIn() } },
    { id: "basemap-road-minor", type: "line", source, "source-layer": "transportation", minzoom: 12, filter: ["match", ["get", "class"], ["minor", "service"], true, false], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": width([12, 0.8, 16, 7]), "line-opacity": fadeIn() } },
    { id: "basemap-road-casing", type: "line", source, "source-layer": "transportation", minzoom: 6, filter: majorRoads, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#cfd5de", "line-width": width([6, 0.8, 10, 3, 14, 10, 16, 16]), "line-opacity": fadeIn() } },
    { id: "basemap-road", type: "line", source, "source-layer": "transportation", minzoom: 6, filter: majorRoads, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": width([6, 0.4, 10, 2, 14, 8, 16, 13]), "line-opacity": fadeIn() } },
    { id: "basemap-water-name", type: "symbol", source, "source-layer": "water_name", minzoom, layout: { "text-field": text, "text-font": regular, "text-size": 12, "text-max-width": 8 }, paint: { "text-color": "#5b7fb0", ...halo, "text-opacity": fadeIn() } },
    { id: "basemap-road-name", type: "symbol", source, "source-layer": "transportation_name", minzoom: 13, layout: { "text-field": text, "text-font": regular, "text-size": 11, "symbol-placement": "line" }, paint: { "text-color": "#6b7280", ...halo } },
    { id: "basemap-place-state", type: "symbol", source, "source-layer": "place", minzoom: 5, maxzoom: 9, filter: ["match", ["get", "class"], ["state", "province"], true, false], layout: { "text-field": text, "text-font": regular, "text-size": 13, "text-letter-spacing": 0.05, "text-max-width": 7 }, paint: { "text-color": "#64748b", ...halo, "text-opacity": fadeIn() } },
    { id: "basemap-place-country", type: "symbol", source, "source-layer": "place", minzoom, maxzoom: 5, filter: ["==", ["get", "class"], "country"], layout: { "text-field": text, "text-font": bold, "text-size": 14, "text-max-width": 7 }, paint: { "text-color": "#334155", ...halo, "text-opacity": fadeIn() } },
    { id: "basemap-place-city", type: "symbol", source, "source-layer": "place", minzoom: 5, filter: ["==", ["get", "class"], "city"], layout: { "text-field": text, "text-font": bold, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12, 10, 16], "text-max-width": 7 }, paint: { "text-color": "#1f2937", ...halo, "text-opacity": fadeIn() } },
    { id: "basemap-place-town", type: "symbol", source, "source-layer": "place", minzoom: 8, filter: ["==", ["get", "class"], "town"], layout: { "text-field": text, "text-font": regular, "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 13, 14], "text-max-width": 7 }, paint: { "text-color": "#334155", ...halo } },
    { id: "basemap-place-local", type: "symbol", source, "source-layer": "place", minzoom: 11, filter: ["match", ["get", "class"], ["village", "suburb", "quarter", "neighbourhood"], true, false], layout: { "text-field": text, "text-font": regular, "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11, 15, 13], "text-max-width": 7 }, paint: { "text-color": "#52607a", ...halo } },
  ];
}
