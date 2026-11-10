"use client";
import { useTranslations } from "@/components/language-provider";

import { countries, isCountryCode, type CountryCode } from "@/lib/countries";
import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry, LineString, Point } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { KoreaMap } from "./korea-map";
import { EventClusterDialog } from "./event-cluster-dialog";
import { EventMapPosters, type MapPosterGroup } from "./event-map-posters";
import { eventPath, type FestivalEvent } from "@/lib/events";
import { EventPosterDialog } from "./event-poster-dialog";

export type EventMapPoint = { countryCode?: CountryCode; id: string; slug: string; title: string; latitude: number; longitude: number };
type Coordinates = { latitude: number; longitude: number };
type Props = ({ points: EventMapPoint[]; fitToPoints?: boolean; point?: never; onPick?: never } | { points?: never; fitToPoints?: never; point: Coordinates | null; onPick: (point: Coordinates) => void }) & { country?: CountryCode; overview?: boolean; onReady?: (focusCountry: (country: CountryCode) => void) => void; onCountryFocused?: () => void };

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

export function EventMap({ points, point, onPick, fitToPoints = false, country = "kr", overview = false, onReady, onCountryFocused }: Props) {
  const { t, locale } = useTranslations();
  const container = useRef<HTMLDivElement>(null);
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
    const controller = new AbortController();
    setFailed(false);
    async function start() {
      const [lib, response, worldResponse] = await Promise.all([
        import("maplibre-gl"),
        isPicker ? fetch("/api/map-config", { signal: controller.signal }) : Promise.resolve(null),
        !isPicker ? fetch("/assets/world.json", { signal: controller.signal }) : Promise.resolve(null),
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
          projection: { type: isPicker ? "mercator" : "globe" },
          sources: config ? { basemap: { type: "raster", tiles: [config.tiles], tileSize: 256, maxzoom: 19, attribution } } : { land: { type: "geojson", data: land } },
          layers: [
            { id: "space", type: "background", paint: { "background-color": "#ffffff" } },
            ...(config ? [{ id: "basemap", type: "raster" as const, source: "basemap", paint: { "raster-saturation": -1, "raster-contrast": 0.05, "raster-brightness-min": 0.55, "raster-brightness-max": 1, "raster-opacity": 0.8 } }] : []),
            ...(!isPicker ? [
              { id: "land-fill", type: "fill" as const, source: "land", paint: { "fill-color": "#eaf2ff", "fill-opacity": 0.85 } },
              { id: "land-outline", type: "line" as const, source: "land", paint: { "line-color": "#7ba6e8", "line-width": 0.8, "line-opacity": 0.7 } },
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
      });
      map.current = instance;
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
      const updateGrid = () => {
        if (!instance) return;
        (instance.getSource("coordinate-grid") as GeoJSONSource | undefined)?.setData(coordinateGrid(instance));
      };
      instance.on("move", updateCoordinates);
      instance.on("moveend", updateGrid);
      instance.on("load", () => {
        if (!instance) return;
        if (!isPicker) {
          instance.addSource("coordinate-grid", { type: "geojson", data: coordinateGrid(instance) });
          instance.addLayer({ id: "coordinate-grid", type: "line", source: "coordinate-grid", paint: { "line-color": "#377ce5", "line-width": 0.8, "line-opacity": 0.38 } });
        }
        updateCoordinates();
        if (!isPicker) ready.current?.((targetCountry) => {
          if (!instance) return;
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
              if (ids.length) setClusterIds(ids);
            }).catch(() => { /* Source may change during a filter/navigation. */ });
          };
          instance.on("click", "event-clusters", (event) => {
            const cluster = event.features?.[0];
            if (cluster) openGroup.current?.({ clusterIds: [Number(cluster.properties.cluster_id)], eventIds: [], count: Number(cluster.properties.point_count), titles: [] });
          });
          hoverGroup.current = async (group, position) => {
            clearHover();
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
            const nearby = instance.queryRenderedFeatures([[event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8]], { layers: ["event-points"] });
            const content = document.createElement("div");
            content.className = "event-map__popup";
            const seen = new Set<string>();
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
    return () => { disposed = true; cleanupHover?.(); hoverGroup.current = null; leaveGroup.current = null; controller.abort(); observer?.disconnect(); marker.current?.remove(); marker.current = null; setPosterMap(null); openGroup.current = null; instance?.remove(); map.current = null; };
  }, [isPicker, fitToPoints, overview, country, retry]);

  useEffect(() => {
    const root = container.current;
    for (const [selector, label] of [[".maplibregl-ctrl-zoom-in", t("확대")], [".maplibregl-ctrl-zoom-out", t("축소")], ["[data-globe-reset]", t("지구 전체 보기")]]) {
      const button = root?.querySelector<HTMLElement>(selector);
      if (button) { button.title = label; button.setAttribute("aria-label", label); }
    }
    map.current?.getCanvas().setAttribute("aria-label", t("행사 지도"));
  }, [locale, posterMap, t]);

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
      {!isPicker && posterMap && <EventMapPosters map={posterMap} points={points || []} onOpenGroup={(group) => openGroup.current?.(group)} onHoverGroup={(group, position) => hoverGroup.current?.(group, position)} onLeaveGroup={() => leaveGroup.current?.()} />}
      {!isPicker && <output ref={coordinates} className="event-map__coordinates" aria-hidden="true" />}
      {!isPicker && <span className="event-map__reticle" aria-hidden="true" />}
      {clusterIds && <EventClusterDialog ids={clusterIds} onDismiss={() => setClusterIds(null)} />}
      {openedEvent && <EventPosterDialog event={openedEvent} opener={eventOpener} onDismiss={() => setOpenedEvent(null)} />}
    </div>
  );
}
