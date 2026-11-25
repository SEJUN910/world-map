"use client";
import { useTranslations } from "@/components/language-provider";

import { countries, isCountryCode, pointInCountry, type CountryCode } from "@/lib/countries";
import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry, LineString, Point } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Marker, PointLike } from "maplibre-gl";
import { KoreaMap } from "./korea-map";
import { EventClusterDialog } from "./event-cluster-dialog";
import { EventMapPosters, type MapPosterGroup } from "./event-map-posters";
import { eventPath, type FestivalEvent } from "@/lib/events";
import { EventPosterDialog } from "./event-poster-dialog";
import type { MapBounds } from "@/lib/discovery-filters";
import { BASEMAP_ATTACH_ZOOM, BASEMAP_BACKGROUND, BASEMAP_FADE, BASEMAP_GLYPHS, BASEMAP_LABEL_LAYERS, BASEMAP_SOURCE, LOCAL_IDEOGRAPH_FONTS, basemapLayers, basemapSource, fadeOut, labelField } from "@/lib/map-style";

// Changing `nonce` re-centres the map on the coordinates, even for the same event.
export type MapFocusTarget = { latitude: number; longitude: number; nonce: number };
export type EventMapPoint = { countryCode?: CountryCode; id: string; slug: string; title: string; latitude: number; longitude: number };
type Coordinates = { latitude: number; longitude: number };
type Props = ({ points: EventMapPoint[]; fitToPoints?: boolean; point?: never; onPick?: never } | { points?: never; fitToPoints?: never; point: Coordinates | null; onPick: (point: Coordinates) => void }) & { country?: CountryCode; overview?: boolean; onReady?: (focusCountry: (country: CountryCode) => void) => void; onCountryFocused?: () => void; onSelectEvents?: (ids: string[]) => void; onSelectGroup?: (ids: string[]) => void; selectedEventId?: string; onViewportChange?: (bounds: MapBounds, userChanged: boolean) => void; onEventHighlight?: (id: string | null) => void; highlightedId?: string | null; onCountryClick?: (country: CountryCode) => void; focusTarget?: MapFocusTarget | null };

function globeZoom(element: HTMLElement) {
  return Math.log2(Math.min(element.clientWidth * 0.8, element.clientHeight * 0.65, 740) * Math.PI / 512);
}

function collection(points: EventMapPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.filter((event) => Number.isFinite(event.longitude) && Number.isFinite(event.latitude) && Math.abs(event.longitude) <= 180 && Math.abs(event.latitude) <= 85)
      .map((event) => ({ type: "Feature", geometry: { type: "Point", coordinates: [event.longitude, event.latitude] }, properties: { id: event.id, slug: event.slug, title: event.title, countryCode: event.countryCode || "kr" } })),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function coordinateGrid(map: MapLibreMap): FeatureCollection<LineString> {
  const zoom = map.getZoom();
  const step = zoom < 3 ? 15 : zoom < 5 ? 5 : zoom < 7 ? 2 : zoom < 9 ? 0.5 : zoom < 11 ? 0.1 : zoom < 13 ? 0.025 : zoom < 15 ? 0.005 : 0.001;
  const bounds = map.getBounds();
  // Low zoom grids cover the whole sphere, including the date line.
  const global = zoom < 5;
  const west = global ? -180 : Math.max(-180, bounds.getWest() - step * 4);
  const east = global ? 180 : Math.min(180, bounds.getEast() + step * 4);
  const south = global ? -85 : Math.max(-85, bounds.getSouth() - step * 4);
  const north = global ? 85 : Math.min(85, bounds.getNorth() + step * 4);
  const features: FeatureCollection<LineString>["features"] = [];
  for (let x = Math.ceil(west / step); x * step <= east; x++) {
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[x * step, south], [x * step, north]] } });
  }
  for (let y = Math.ceil(south / step); y * step <= north; y++) {
    const line: number[][] = [];
    const segments = Math.max(1, Math.ceil((east - west) / 2));
    for (let segment = 0; segment <= segments; segment++) line.push([west + (east - west) * segment / segments, y * step]);
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } });
  }
  return { type: "FeatureCollection", features };
}

export function EventMap({ points, point, onPick, fitToPoints = false, country = "kr", overview = false, onReady, onCountryFocused, onSelectEvents, onSelectGroup, selectedEventId, onViewportChange, onEventHighlight, highlightedId, onCountryClick, focusTarget }: Props) {
  const { t, locale } = useTranslations();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const translate = useRef(t);
  translate.current = t;
  const countryClick = useRef(onCountryClick);
  countryClick.current = onCountryClick;
  const container = useRef<HTMLDivElement>(null);
  const selection = useRef(onSelectEvents);
  // Desktop: a group (cluster or grouped poster) goes to the list panel instead of the popup.
  const groupSelection = useRef(onSelectGroup);
  groupSelection.current = onSelectGroup;
  const viewport = useRef(onViewportChange);
  const selected = useRef(selectedEventId);
  selection.current = onSelectEvents;
  viewport.current = onViewportChange;
  selected.current = selectedEventId;
  const coordinates = useRef<HTMLOutputElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const latestPoints = useRef(points || []);
  const latestPoint = useRef(point);
  const pick = useRef(onPick);
  latestPoints.current = points || [];
  latestPoint.current = point;
  pick.current = onPick;
  const [failed, setFailed] = useState(false);
  const [posterMap, setPosterMap] = useState<MapLibreMap | null>(null);
  const [openedEvent, setOpenedEvent] = useState<FestivalEvent | null>(null);
  const eventOpener = useRef<HTMLAnchorElement | null>(null);
  const [clusterIds, setClusterIds] = useState<string[] | null>(null);
  const openGroup = useRef<((group: MapPosterGroup) => void) | null>(null);
  const hoverGroup = useRef<((group: MapPosterGroup, position: [number, number]) => void) | null>(null);
  const leaveGroup = useRef<(() => void) | null>(null);
  const onEventHighlightRef = useRef(onEventHighlight);
  onEventHighlightRef.current = onEventHighlight;
  const [retry, setRetry] = useState(0);
  const isPicker = !!onPick;
  const ready = useRef(onReady);
  const focused = useRef(onCountryFocused);
  ready.current = onReady;
  focused.current = onCountryFocused;

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let instance: MapLibreMap | undefined;
    let cleanupHover: (() => void) | undefined;
    let cleanupBasemap: (() => void) | undefined;
    const controller = new AbortController();
    setFailed(false);
    // Set while a country flight runs, so hover and clicks cannot start a second one.
    let focusLock = false;
    let markCountry: ((country: CountryCode) => void) | undefined;
    async function start() {
      const [lib, response, worldResponse, boundaries] = await Promise.all([
        import("maplibre-gl"),
        isPicker ? fetch("/api/map-config", { signal: controller.signal }) : Promise.resolve(null),
        !isPicker ? fetch("/assets/world.json", { signal: controller.signal }) : Promise.resolve(null),
        // Country click targets are optional: a missing boundary only disables clicking that country.
        overview ? Promise.all((Object.keys(countries) as CountryCode[]).map((code) =>
          fetch(countries[code].boundary, { signal: controller.signal })
            .then(async (boundary) => boundary.ok ? { type: "Feature" as const, id: code, properties: { code }, geometry: await boundary.json() as Geometry } : null)
            .catch(() => null))) : Promise.resolve([]),
      ]);
      if (worldResponse && !worldResponse.ok) throw new Error("World geometry unavailable");
      const world: { t: Geometry["type"]; c: unknown }[] = worldResponse ? await worldResponse.json() : [];
      const land: FeatureCollection = { type: "FeatureCollection", features: world.map((feature) => ({ type: "Feature", properties: {}, geometry: { type: feature.t, coordinates: feature.c } as Geometry })) };
      if (response && !response.ok) throw new Error("Map configuration unavailable");
      const config: { tiles: string; attribution: string; openStreetMap: boolean } | null = response ? await response.json() : null;
      if (disposed || !container.current) return;
      lib.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const attribution = config?.openStreetMap
        ? '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
        : escapeHtml(config?.attribution || "");
      instance = new lib.Map({
        container: container.current,
        style: {
          version: 8,
          ...(isPicker ? {} : { glyphs: BASEMAP_GLYPHS }),
          projection: { type: isPicker ? "mercator" : "globe" },
          sources: config ? { basemap: { type: "raster", tiles: [config.tiles], tileSize: 256, maxzoom: 19, attribution } } : { land: { type: "geojson", data: land } },
          layers: [
            { id: "space", type: "background", paint: { "background-color": "#ffffff" } },
            ...(config ? [{ id: "basemap", type: "raster" as const, source: "basemap", paint: { "raster-saturation": -1, "raster-contrast": 0.05, "raster-brightness-min": 0.55, "raster-brightness-max": 1, "raster-opacity": 0.8 } }] : []),
            ...(!isPicker ? [
              { id: "land-fill", type: "fill" as const, source: "land", paint: { "fill-color": "#d9e6f7", "fill-opacity": 1 } },
              { id: "land-outline", type: "line" as const, source: "land", paint: { "line-color": "#5d8bd0", "line-width": 0.9, "line-opacity": 0.85 } },
            ] : []),
          ],
        },
        center: latestPoint.current ? [latestPoint.current.longitude, latestPoint.current.latitude] : overview ? [115, 25] : countries[country].center,
        zoom: latestPoint.current ? 13 : overview ? globeZoom(container.current) : countries[country].zoom,
        minZoom: isPicker ? 2 : -0.5,
        maxZoom: 19,
        locale: { "NavigationControl.ZoomIn": t("확대"), "NavigationControl.ZoomOut": t("축소"), "Map.Title": t("행사 지도") },
        renderWorldCopies: false,
        attributionControl: false,
        ...(isPicker ? {} : { localIdeographFontFamily: LOCAL_IDEOGRAPH_FONTS }),
      });
      map.current = instance;
      instance.on("moveend", event => {
        if (!instance || isPicker || overview) return;
        const b = instance.getBounds();
        const bounds: MapBounds = [Math.max(-180,b.getWest()),Math.max(-85,b.getSouth()),Math.min(180,b.getEast()),Math.min(85,b.getNorth())];
        if (bounds[0] < bounds[2] && bounds[1] < bounds[3]) viewport.current?.(bounds, !!(event as unknown as { originalEvent?: unknown }).originalEvent);
      });
      if (config) instance.addControl(new lib.AttributionControl({ compact: false }), "bottom-right");
      instance.addControl(new lib.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
      if (!isPicker) {
        const control = document.createElement("div");
        control.className = "maplibregl-ctrl maplibregl-ctrl-group";
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.globeReset = "true";
        button.title = t("지구 전체 보기");
        button.setAttribute("aria-label", button.title);
        button.textContent = "◎";
        button.style.cssText = "font-size:22px;color:#2865c5";
        button.onclick = () => {
          if (instance && container.current) instance.flyTo({ zoom: globeZoom(container.current), duration: 1200, pitch: 0, bearing: 0 });
        };
        control.appendChild(button);
        instance.addControl({ onAdd: () => control, onRemove: () => control.remove() }, "top-right");
      }
      instance.dragRotate.disable();
      instance.touchZoomRotate.disableRotation();
      observer = new ResizeObserver(() => instance?.resize());
      observer.observe(container.current);

      const updateCoordinates = () => {
        if (!instance || !coordinates.current) return;
        const center = instance.getCenter();
        const longitude = ((center.lng + 180) % 360 + 360) % 360 - 180;
        coordinates.current.textContent = `LAT ${Math.abs(center.lat).toFixed(4)}° ${center.lat < 0 ? "S" : "N"}   /   LON ${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? "W" : "E"}`;
      };
      // While the basemap is shown the grid is invisible from zoom 5, so it is not recomputed there.
      let basemapActive = false;
      const updateGrid = () => {
        if (!instance || (basemapActive && instance.getZoom() >= BASEMAP_FADE[1])) return;
        (instance.getSource("coordinate-grid") as GeoJSONSource | undefined)?.setData(coordinateGrid(instance));
      };
      instance.on("move", updateCoordinates);
      instance.on("moveend", updateGrid);
      instance.on("load", () => {
        if (!instance) return;
        if (!isPicker) {
          instance.addSource("coordinate-grid", { type: "geojson", data: coordinateGrid(instance) });
          instance.addLayer({ id: "coordinate-grid", type: "line", source: "coordinate-grid", paint: { "line-color": "#377ce5", "line-width": 0.8, "line-opacity": 0.22 } });
          // Detailed basemap (roads, water, place names) under the grid and the event layers.
          // If the tile server fails, it is removed and the world.json globe comes back,
          // then retried (up to 3 times in a row; a loaded tile resets the count) when the browser is back online or on a map move
          // once a backoff of 30s, 60s, 120s has passed.
          let attached = false, gaveUp = false, tilesLoaded = false, tileErrors = 0, retries = 0, retryAt = 0;
          let basemapAttribution: InstanceType<typeof lib.AttributionControl> | undefined;
          const restoreGlobe = () => {
            if (!instance) return;
            for (const layer of basemapLayers(localeRef.current)) if (instance.getLayer(layer.id)) instance.removeLayer(layer.id);
            if (instance.getSource(BASEMAP_SOURCE)) instance.removeSource(BASEMAP_SOURCE);
            instance.setPaintProperty("space", "background-color", "#ffffff");
            instance.setPaintProperty("land-fill", "fill-opacity", 1);
            instance.setPaintProperty("land-outline", "line-opacity", 0.85);
            instance.setPaintProperty("coordinate-grid", "line-opacity", 0.22);
            if (instance.getLayer("country-fill")) instance.setPaintProperty("country-fill", "fill-opacity", 0.9);
            if (basemapAttribution) instance.removeControl(basemapAttribution);
            basemapAttribution = undefined;
            basemapActive = false;
            updateGrid();
          };
          const attachBasemap = () => {
            if (!instance || attached || gaveUp) return;
            attached = true;
            basemapActive = true;
            instance.addSource(BASEMAP_SOURCE, basemapSource);
            for (const layer of basemapLayers(localeRef.current)) instance.addLayer(layer, "coordinate-grid");
            instance.setPaintProperty("space", "background-color", BASEMAP_BACKGROUND);
            instance.setPaintProperty("land-fill", "fill-opacity", fadeOut(1));
            instance.setPaintProperty("land-outline", "line-opacity", fadeOut(0.85));
            instance.setPaintProperty("coordinate-grid", "line-opacity", fadeOut(0.22));
            const compact = window.matchMedia("(max-width: 700px)").matches;
            // The home globe's country fill would cover the detail; keep it faint (it is still the click target).
            if (instance.getLayer("country-fill")) instance.setPaintProperty("country-fill", "fill-opacity", fadeOut(0.9, 0.08));
            basemapAttribution = new lib.AttributionControl({ compact });
            instance.addControl(basemapAttribution, "bottom-right");
            // MapLibre opens a compact attribution until the first drag; on a phone it would cover the map buttons.
            if (compact) instance.once("idle", () => instance?.getContainer().querySelector(".maplibregl-ctrl-attrib.maplibregl-compact")?.classList.remove("maplibregl-compact-show"));
          };
          instance.on("data", (event) => {
            if (event.dataType === "source" && (event as { sourceId?: string }).sourceId === BASEMAP_SOURCE && (event as { tile?: unknown }).tile) { tilesLoaded = true; tileErrors = 0; retries = 0; }
          });
          instance.on("error", (event) => {
            if (disposed) return;
            // An "error" listener stops MapLibre's own console logging, so pass other errors on.
            if ((event as { sourceId?: string }).sourceId !== BASEMAP_SOURCE) { console.error(event.error); return; }
            if (gaveUp) return;
            tileErrors++;
            // Unreachable from the start (blocked, down, TileJSON failed) or failing repeatedly in a row.
            if (!tilesLoaded || tileErrors >= 3) {
              gaveUp = true; attached = false; restoreGlobe();
              retryAt = Date.now() + 30_000 * 2 ** retries;
            }
          });
          const retryBasemap = (force: boolean) => {
            if (!instance || disposed || !gaveUp || retries >= 3 || !navigator.onLine || (!force && Date.now() < retryAt)) return;
            if (overview && instance.getZoom() < BASEMAP_ATTACH_ZOOM) return;
            retries++; gaveUp = false; tilesLoaded = false; tileErrors = 0;
            attachBasemap();
          };
          const retryOnMove = () => retryBasemap(false);
          const retryOnline = () => retryBasemap(true);
          instance.on("moveend", retryOnMove);
          window.addEventListener("online", retryOnline);
          cleanupBasemap = () => window.removeEventListener("online", retryOnline);
          if (overview) {
            // The home globe makes no tile requests until the user zooms towards a country.
            const attachWhenClose = () => {
              if (!instance || instance.getZoom() < BASEMAP_ATTACH_ZOOM) return;
              instance.off("zoom", attachWhenClose);
              attachBasemap();
            };
            instance.on("zoom", attachWhenClose);
            attachWhenClose();
          } else attachBasemap();
        }
        updateCoordinates();
        if (!isPicker) ready.current?.((targetCountry) => {
          if (!instance || focusLock) return;
          focusLock = true;
          markCountry?.(targetCountry);
          instance.stop();
          // The country handoff owns this flight; gestures must not interrupt it.
          instance.dragPan.disable();
          instance.scrollZoom.disable();
          instance.doubleClickZoom.disable();
          instance.touchZoomRotate.disable();
          instance.keyboard.disable();
          instance.once("moveend", () => focused.current?.());
          instance.flyTo({ center: countries[targetCountry].center, zoom: countries[targetCountry].zoom, duration: 1500 });
        });
      });

      if (isPicker) {
        const setPosition = (latitude: number, longitude: number) => pick.current?.({ latitude: Number(latitude.toFixed(5)), longitude: Number(longitude.toFixed(5)) });
        const pin = new lib.Marker({ color: "#2865d8", draggable: true });
        marker.current = pin;
        if (latestPoint.current) pin.setLngLat([latestPoint.current.longitude, latestPoint.current.latitude]).addTo(instance);
        pin.on("dragend", () => { const position = pin.getLngLat(); setPosition(position.lat, position.lng); });
        instance.on("click", (event) => { pin.setLngLat(event.lngLat).addTo(instance!); setPosition(event.lngLat.lat, event.lngLat.lng); });
      } else {
        instance.on("load", () => {
          if (!instance) return;
          if (fitToPoints) {
            const coordinates = collection(latestPoints.current).features.map((feature) => feature.geometry.coordinates as [number, number]);
            if (coordinates.length === 1) instance.easeTo({ center: coordinates[0], zoom: 10, duration: 500 });
            else if (coordinates.length > 1) {
              const bounds = new lib.LngLatBounds();
              for (const coordinate of coordinates) bounds.extend(coordinate);
              instance.fitBounds(bounds, { padding: 50, maxZoom: 11, duration: 500 });
            }
          }
          let markerCountry: ((coordinates: [number, number]) => boolean) | undefined;
          const countryFeatures = boundaries.filter((feature) => feature !== null);
          if (overview && countryFeatures.length) {
            instance.addSource("countries", { type: "geojson", data: { type: "FeatureCollection", features: countryFeatures } });
            const active: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
            instance.addLayer({ id: "country-fill", type: "fill", source: "countries", paint: { "fill-color": ["case", active, "#9dbdf0", "#c9dbf8"], "fill-opacity": 0.9 } });
            instance.addLayer({ id: "country-outline", type: "line", source: "countries", paint: { "line-color": "#2865c5", "line-width": ["case", active, 1.6, 1], "line-opacity": ["case", active, 0.9, 0.55] } });
            const tip = new lib.Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 14, className: "country-hover-popup" });
            let hovered: CountryCode | null = null;
            const setHover = (code: CountryCode | null) => {
              if (!instance || hovered === code) return;
              if (hovered) instance.setFeatureState({ source: "countries", id: hovered }, { hover: false });
              hovered = code;
              if (code) instance.setFeatureState({ source: "countries", id: code }, { hover: true });
            };
            const clearHover = () => {
              if (focusLock || !instance) return;
              if (hovered) instance.getCanvas().style.cursor = "";
              setHover(null);
              tip.remove();
            };
            markCountry = (code) => { setHover(code); tip.remove(); };
            // Event markers sit above countries and keep their own hover and click behavior.
            const onMarker = (point: PointLike) => !!instance?.queryRenderedFeatures(point, { layers: ["event-clusters", "event-points"] }).length;
            const countryAt = (point: { x: number; y: number }, radius: number) => {
              const code = instance?.queryRenderedFeatures([[point.x - radius, point.y - radius], [point.x + radius, point.y + radius]], { layers: ["country-fill"] })[0]?.properties?.code;
              return isCountryCode(code) ? code : null;
            };
            instance.on("mousemove", (event) => {
              if (!instance || focusLock) return;
              if (onMarker(event.point)) { setHover(null); tip.remove(); return; }
              const code = countryAt(event.point, 2);
              if (!code) return clearHover();
              setHover(code);
              instance.getCanvas().style.cursor = "pointer";
              tip.setLngLat(event.lngLat).setText(translate.current(countries[code].name)).addTo(instance);
            });
            instance.on("mouseout", clearHover);
            instance.on("dragstart", clearHover);
            instance.on("click", (event) => {
              if (!countryClick.current || focusLock || onMarker(event.point)) return;
              const original = event.originalEvent;
              if (original.button !== 0 || original.metaKey || original.ctrlKey || original.shiftKey || original.altKey) return;
              // Countries are small on the globe, so touch gets a wider hit area than a mouse pointer.
              const touch = (original as PointerEvent).pointerType === "touch" || window.matchMedia("(pointer: coarse)").matches;
              const code = countryAt(event.point, touch ? 12 : 3);
              if (code) countryClick.current(code);
            });
            // At globe zoom the event dots cover most of Korea and all of Taiwan, so a dot inside
            // a supported country is the country's click target here.
            markerCountry = (coordinates) => {
              if (!instance || !countryClick.current || focusLock) return false;
              const [longitude, latitude] = coordinates;
              const code = countryAt(instance.project(coordinates), 12)
                ?? (Object.keys(countries) as CountryCode[]).find((candidate) => pointInCountry(candidate, { latitude, longitude }));
              if (!code) return false;
              countryClick.current(code);
              return true;
            };
          }
          instance.addSource("events", { type: "geojson", data: collection(latestPoints.current), cluster: true, clusterMaxZoom: 15, clusterRadius: 40 });
          instance.addLayer({ id: "event-clusters", type: "circle", source: "events", filter: ["has", "point_count"], paint: { "circle-color": "#f39451", "circle-radius": ["step", ["get", "point_count"], 9, 10, 13, 50, 17], "circle-stroke-width": 2, "circle-stroke-color": "#ffffff", "circle-opacity": 1 } });
          instance.addLayer({ id: "event-points", type: "circle", source: "events", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#f39451", "circle-radius": 5, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff", "circle-opacity": 1 } });
          setPosterMap(instance);
          let hoverPopup: InstanceType<typeof lib.Popup> | undefined;
          let hoverGeneration = 0;
          let selectionGeneration = 0;
          let hoverTimer: ReturnType<typeof setTimeout> | undefined;
          const keepHover = () => clearTimeout(hoverTimer);
          const clearHover = () => { keepHover(); hoverGeneration++; hoverPopup?.remove(); hoverPopup = undefined; };
          const leaveHover = () => {
            keepHover();
            hoverTimer = setTimeout(() => {
              const popup = hoverPopup?.getElement();
              if (popup?.matches(":hover") || popup?.contains(document.activeElement)) return;
              clearHover();
            }, 350);
          };
          cleanupHover = clearHover;
          leaveGroup.current = leaveHover;
          openGroup.current = (group: MapPosterGroup) => {
            clearHover();
            const generation = ++selectionGeneration;
            const source = instance?.getSource("events") as GeoJSONSource | undefined;
            if (!source) return;
            void Promise.all(group.clusterIds.map((id) => source.getClusterLeaves(id, 5000, 0))).then((batches) => {
              if (disposed || generation !== selectionGeneration) return;
              const ids = [...new Set([...group.eventIds, ...batches.flat().map((leaf) => String(leaf.properties?.id || "")).filter(Boolean)])];
              const pick = selection.current ?? groupSelection.current;
              if (ids.length) { if (pick) pick(ids); else setClusterIds(ids); }
            }).catch(() => { /* Source may change during a filter/navigation. */ });
          };
          instance.on("click", "event-clusters", (event) => {
            const cluster = event.features?.[0];
            if (cluster?.geometry.type === "Point" && markerCountry?.(cluster.geometry.coordinates as [number, number])) return;
            if (cluster) openGroup.current?.({ clusterIds: [Number(cluster.properties.cluster_id)], eventIds: [], count: Number(cluster.properties.point_count), titles: [] });
          });
          hoverGroup.current = async (group, position) => {
            clearHover();
            if (selection.current) return;
            const generation = hoverGeneration;
            const source = instance?.getSource("events") as GeoJSONSource | undefined;
            if (!source) return;
            const batches = await Promise.all(group.clusterIds.map((id) => source.getClusterLeaves(id, 8, 0).catch(() => [])));
            if (disposed || generation !== hoverGeneration) return;
            const byId = new Map(latestPoints.current.map((point) => [point.id, point]));
            const ids = [...new Set([...group.eventIds, ...batches.flat().map((leaf) => String(leaf.properties?.id || ""))])].filter((id) => byId.has(id)).slice(0, 8);
            if (!ids.length) return;
            const content = document.createElement("div");
            content.className = "cluster-hover";
            const heading = document.createElement("strong");
            heading.textContent = t("{count}개 행사", { count: group.count });
            content.appendChild(heading);
            const list = document.createElement("ul");
            for (const id of ids) {
              const item = document.createElement("li");
              const link = document.createElement("a");
              link.href = eventPath({ id, countryCode: byId.get(id)?.countryCode });
              link.textContent = byId.get(id)!.title;
              link.addEventListener("click", (click) => {
                if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
                click.preventDefault();
                keepHover();
                if (link.getAttribute("aria-busy") === "true") return;
                link.setAttribute("aria-busy", "true");
                void fetch(`/api/map-posters?ids=${encodeURIComponent(id)}`, { signal: controller.signal }).then(async (response) => {
                  if (!response.ok) throw new Error();
                  const events: FestivalEvent[] = await response.json();
                  if (!events[0]) throw new Error();
                  if (!disposed) { eventOpener.current = link; setOpenedEvent(events[0]); }
                }).catch(() => {
                  if (!disposed) link.textContent = t("불러오지 못했어요. 다시 눌러주세요.");
                }).finally(() => link.removeAttribute("aria-busy"));
              });
              item.appendChild(link);
              list.appendChild(item);
            }
            content.appendChild(list);
            if (group.count > ids.length) {
              const all = document.createElement("button");
              all.type = "button";
              all.className = "cluster-hover__all";
              all.textContent = t("전체 {count}개 보기 →", { count: group.count });
              all.onclick = () => openGroup.current?.(group);
              content.appendChild(all);
            }
            hoverPopup = new lib.Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 24, maxWidth: "300px", className: "cluster-hover-popup" })
              .setLngLat(position).setDOMContent(content).addTo(instance!);
            const element = hoverPopup.getElement();
            element.addEventListener("mouseenter", keepHover);
            element.addEventListener("mouseleave", leaveHover);
            element.addEventListener("focusin", keepHover);
            element.addEventListener("focusout", leaveHover);
            element.addEventListener("keydown", (event) => { if (event.key === "Escape") clearHover(); });
          };
          for (const layer of ["event-clusters", "event-points"]) {
            instance.on("mouseenter", layer, (event) => {
              const feature = event.features?.[0];
              if (!feature || feature.geometry.type !== "Point") return;
              const clustered = layer === "event-clusters";
              hoverGroup.current?.({ clusterIds: clustered ? [Number(feature.properties.cluster_id)] : [], eventIds: clustered ? [] : [String(feature.properties.id)], count: clustered ? Number(feature.properties.point_count) : 1, titles: [] }, feature.geometry.coordinates as [number, number]);
            });
            instance.on("mouseleave", layer, leaveHover);
          }
          instance.on("movestart", clearHover);
          instance.on("click", "event-points", (event) => {
            if (!instance) return;
            const hit = event.features?.[0];
            if (hit?.geometry.type === "Point" && markerCountry?.(hit.geometry.coordinates as [number, number])) return;
            const nearby = instance.queryRenderedFeatures([[event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8]], { layers: ["event-points"] });
            if (selection.current) {
              const ids = [...new Set(nearby.map(feature => String(feature.properties?.id || "")).filter(Boolean))];
              if (ids.length) selection.current(ids);
              return;
            }
            const content = document.createElement("div");
            content.className = "event-map__popup";
            const seen = new Set<string>();
            if (instance.getZoom() < 6 && nearby[0]?.properties?.id) {
              onEventHighlightRef.current?.(String(nearby[0].properties.id));
            }
            for (const feature of nearby) {
              const properties = feature.properties;
              if (!properties?.id || seen.has(String(properties.id))) continue;
              seen.add(String(properties.id));
              const link = document.createElement("a");
              link.href = eventPath({ id: String(properties.id), countryCode: isCountryCode(properties.countryCode) ? properties.countryCode : "kr" });
              link.textContent = String(properties.title);
              link.addEventListener("click", (click) => {
                if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
                click.preventDefault();
                if (link.getAttribute("aria-busy") === "true") return;
                link.setAttribute("aria-busy", "true");
                void fetch(`/api/map-posters?ids=${encodeURIComponent(String(properties.id))}`, { signal: controller.signal })
                  .then(async (response) => {
                    if (!response.ok) throw new Error();
                    const events: FestivalEvent[] = await response.json();
                    if (!events[0]) throw new Error();
                    if (!disposed) { eventOpener.current = link; setOpenedEvent(events[0]); }
                  }).catch(() => {
                    if (!disposed) link.textContent = t("불러오지 못했어요. 다시 눌러주세요.");
                  }).finally(() => link.removeAttribute("aria-busy"));
              });
              content.appendChild(link);
            }
            if (seen.size) new lib.Popup({ offset: 12, maxWidth: "260px" }).setLngLat(event.lngLat).setDOMContent(content).addTo(instance);
          });
          for (const layer of ["event-clusters", "event-points"]) {
            instance.on("mouseenter", layer, () => { if (instance) instance.getCanvas().style.cursor = "pointer"; });
            instance.on("mouseleave", layer, () => { if (instance) instance.getCanvas().style.cursor = ""; });
          }
        });
      }
    }
    void start().catch((error) => { if (!disposed && error.name !== "AbortError") setFailed(true); });
    return () => { disposed = true; cleanupHover?.(); cleanupBasemap?.(); hoverGroup.current = null; leaveGroup.current = null; controller.abort(); observer?.disconnect(); marker.current?.remove(); marker.current = null; setPosterMap(null); openGroup.current = null; instance?.remove(); map.current = null; };
  }, [isPicker, fitToPoints, overview, country, retry]);

  // posterMap is set once the map has loaded, so a target given before that
  // (for example right after switching from the list view) still applies.
  useEffect(() => {
    if (!focusTarget || !posterMap) return;
    posterMap.stop();
    posterMap.flyTo({ center: [focusTarget.longitude, focusTarget.latitude], zoom: Math.max(posterMap.getZoom(), 10), duration: 700 });
  }, [focusTarget?.nonce, posterMap]);

  useEffect(() => {
    if (map.current?.getLayer("event-points")) map.current.setPaintProperty("event-points", "circle-color", ["case", ["==", ["get", "id"], selectedEventId || ""], "#2865c5", "#f39451"]);
  }, [selectedEventId, posterMap]);

  useEffect(() => {
    const root = container.current;
    for (const [selector, label] of [[".maplibregl-ctrl-zoom-in", t("확대")], [".maplibregl-ctrl-zoom-out", t("축소")], ["[data-globe-reset]", t("지구 전체 보기")]]) {
      const button = root?.querySelector<HTMLElement>(selector);
      if (button) { button.title = label; button.setAttribute("aria-label", label); }
    }
    map.current?.getCanvas().setAttribute("aria-label", t("행사 지도"));
  }, [locale, posterMap, t]);

  // Place names follow the UI language without moving the map.
  useEffect(() => {
    for (const id of BASEMAP_LABEL_LAYERS) if (map.current?.getLayer(id)) map.current.setLayoutProperty(id, "text-field", labelField(locale));
  }, [locale, posterMap]);

  useEffect(() => {
    const source = map.current?.getSource("events") as GeoJSONSource | undefined;
    source?.setData(collection(points || []));
  }, [points]);

  useEffect(() => {
    if (!isPicker || !point || !map.current || !marker.current) return;
    const position = marker.current.getLngLat();
    if (Math.abs(position.lat - point.latitude) > 0.00001 || Math.abs(position.lng - point.longitude) > 0.00001 || !marker.current.getElement().isConnected) {
      marker.current.setLngLat([point.longitude, point.latitude]).addTo(map.current);
      map.current.easeTo({ center: [point.longitude, point.latitude], duration: 300 });
    }
  }, [isPicker, point?.latitude, point?.longitude]);

  if (failed) return <div className="event-map-fallback"><p role="status">{t("상세 지도를 불러오지 못했어요.")}<button type="button" onClick={() => setRetry((value) => value + 1)}>{t("다시 시도")}</button></p>{country === "kr" && <KoreaMap point={point} onPick={onPick} showHelp={false} />}</div>;
  return (
    <div className={`event-map-shell${overview ? " event-map-shell--overview" : ""}`}>
      <div ref={container} className={`event-map${isPicker ? " event-map--picker" : ""}`} role="region" aria-label={isPicker ? t("행사 위치 선택 지도") : t("행사 지도")} />
      {!isPicker && posterMap && <EventMapPosters map={posterMap} points={points || []} selectedEventId={selectedEventId} onSelectEvent={onSelectEvents ? event => selection.current?.([event.id]) : undefined} onOpenGroup={(group) => openGroup.current?.(group)} onHoverGroup={(group, position) => hoverGroup.current?.(group, position)} onLeaveGroup={() => leaveGroup.current?.()} onEventHighlight={onEventHighlightRef.current} highlightedId={highlightedId} />}
      {!isPicker && <output ref={coordinates} className="event-map__coordinates" aria-hidden="true" />}
      {!isPicker && <span className="event-map__reticle" aria-hidden="true" />}
      {clusterIds && <EventClusterDialog ids={clusterIds} onDismiss={() => setClusterIds(null)} />}
      {openedEvent && <EventPosterDialog event={openedEvent} opener={eventOpener} onDismiss={() => setOpenedEvent(null)} />}
    </div>
  );
}
