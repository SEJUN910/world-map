"use client";
import { useTranslations } from "@/components/language-provider";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { eventDate, eventPath, type FestivalEvent } from "@/lib/events";
import type { EventMapPoint } from "./event-map";
import { EventPosterDialog } from "./event-poster-dialog";
import { markerFallback, posterSrc } from "@/lib/poster-image";

export type MapPosterGroup = { clusterIds: number[]; eventIds: string[]; count: number; titles: string[] };

const START_ZOOM = 6;
const FULL_ZOOM = 7;
const MAX_POSTERS = 36;

export function EventMapPosters({ map, points, onOpenGroup, onHoverGroup, onLeaveGroup, onSelectEvent, selectedEventId, onEventHighlight, highlightedId }: { map: MapLibreMap; points: EventMapPoint[]; onOpenGroup: (group: MapPosterGroup) => void; onHoverGroup: (group: MapPosterGroup, position: [number, number]) => void; onLeaveGroup: () => void; onSelectEvent?: (event: FestivalEvent) => void; selectedEventId?: string; onEventHighlight?: (id: string | null) => void; highlightedId?: string | null }) {
  const { t } = useTranslations();
  const root = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLAnchorElement>());
  // event null = asked for but not returned (ended or unpublished): not asked again until it expires.
  const cache = useRef(new Map<string, { event: FestivalEvent | null; expires: number }>());
  // Thumbnail URLs already decoded by the browser (a poster appears only once its image is ready).
  const ready = useRef(new Set<string>());
  const decoding = useRef(new Map<string, Promise<void>>());
  const [events, setEvents] = useState<FestivalEvent[]>([]);
  const [selected, setSelected] = useState<FestivalEvent | null>(null);
  const opener = useRef<HTMLAnchorElement | null>(null);
  const groups = useRef(new Map<string, MapPosterGroup>());
  const positions = useRef(new Map<string, EventMapPoint>());

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    let request: AbortController | undefined;
    let generation = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    // Read-ahead requests live as long as the map, not one zoom step.
    const background = new AbortController();
    const reading = new Set<string>();
    // Posters currently on screen (mounted ones can be off-screen or hidden).
    let visible = 0;
    let wasClose = map.getZoom() >= START_ZOOM;
    const anchors = new Map<string, EventMapPoint>();
    const byId = new Map(points.map((event) => [event.id, event]));

    const position = (event: EventMapPoint) => {
      const center = map.getCenter();
      const radians = Math.PI / 180;
      // Projection alone also returns coordinates for the hidden hemisphere.
      const facing = Math.sin(center.lat * radians) * Math.sin(event.latitude * radians)
        + Math.cos(center.lat * radians) * Math.cos(event.latitude * radians) * Math.cos((event.longitude - center.lng) * radians);
      if (facing <= 0) return null;
      const p = map.project([event.longitude, event.latitude]);
      const { clientWidth: width, clientHeight: height } = map.getContainer();
      return p.x >= 24 && p.x <= width - 24 && p.y >= 36 && p.y <= height - 36 ? p : null;
    };

    const place = () => {
      frame = 0;
      const opacity = Math.max(0, Math.min(1, (map.getZoom() - START_ZOOM) / (FULL_ZOOM - START_ZOOM)));
      root.current?.style.setProperty("--poster-opacity", String(opacity));
      let count = 0;
      for (const [id, element] of elements.current) {
        const event = anchors.get(id);
        const p = event ? position(event) : null;
        const on = !!p && opacity > 0;
        element.style.visibility = on ? "visible" : "hidden";
        element.style.pointerEvents = p && opacity > 0.12 ? "auto" : "none";
        if (on && element.style.display !== "none") count++;
        if (!on) delete element.dataset.placed;
        if (p) {
          // Only a poster already in place may glide (.is-settling); a new or re-shown one appears
          // at its spot instead of flying in from the corner or from where it was last seen.
          const first = !element.dataset.placed;
          if (first) element.style.transition = "none";
          element.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
          element.classList.toggle("is-near-right", p.x > map.getContainer().clientWidth - 240);
          if (first) requestAnimationFrame(() => { element.style.transition = ""; if (element.style.visibility === "visible") element.dataset.placed = "1"; });
        }
      }
      visible = count;
    };
    const move = () => {
      if (root.current?.classList.contains("is-settling") && map.isMoving()) { clearTimeout(settle); root.current.classList.remove("is-settling"); }
      if (!frame) frame = requestAnimationFrame(place);
      const close = map.getZoom() >= START_ZOOM;
      if (close !== wasClose) { wasClose = close; schedule(); }
    };
    // Zooming regroups the clusters and used to look like a reload: every group was looked up one
    // by one (1–3 s of bare dots), then posters popped in as empty circles while their images
    // loaded. Now the lookups run together, the next zoom level's posters are fetched ahead of
    // time, and a poster is only shown once its image is ready.
    const hasPoster = (id: string) => { const cached = cache.current.get(id); return !!cached && cached.expires > Date.now() && !!cached.event?.poster; };
    const isReady = (id: string) => hasPoster(id) && ready.current.has(posterSrc(cache.current.get(id)!.event!.poster, "thumb"));
    const preload = (event: FestivalEvent) => {
      const src = posterSrc(event.poster, "thumb");
      if (ready.current.has(src)) return Promise.resolve();
      const pending = decoding.current.get(src);
      if (pending) return pending;
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      // A broken image still counts as ready: the marker falls back on its own (markerFallback).
      const done = image.decode().catch(() => undefined).then(() => { ready.current.add(src); decoding.current.delete(src); });
      decoding.current.set(src, done);
      return done;
    };
    const remember = (data: FestivalEvent[]) => {
      // Uploaded posters are 5-minute signed URLs; public hosts can be kept longer.
      for (const event of data) cache.current.set(event.id, { event, expires: Date.now() + (event.poster?.includes("/object/sign/") ? 240_000 : 900_000) });
    };
    const fetchPosters = async (ids: string[], signal: AbortSignal) => {
      // The API takes at most 36 ids per request.
      for (let i = 0; i < ids.length; i += 36) {
        const batch = ids.slice(i, i + 36);
        const response = await fetch(`/api/map-posters?ids=${batch.join(",")}`, { signal });
        if (!response.ok) return;
        const data: FestivalEvent[] = await response.json();
        remember(data);
        const returned = new Set(data.map((event) => event.id));
        for (const id of batch) if (!returned.has(id)) cache.current.set(id, { event: null, expires: Date.now() + 900_000 });
      }
    };
    const refresh = async () => {
      const current = ++generation;
      request?.abort();
      clearTimeout(fallback);
      if (map.getZoom() < START_ZOOM) { setEvents([]); return; }
      const source = map.getSource("events") as GeoJSONSource | undefined;
      const features: { feature: MapGeoJSONFeature; clustered: boolean; clusterId: number }[] = [];
      const seen = new Set<string>();
      for (const feature of map.queryRenderedFeatures({ layers: ["event-clusters", "event-points"] })) {
        if (feature.geometry.type !== "Point") continue;
        const clustered = !!feature.properties.cluster;
        const clusterId = Number(feature.properties.cluster_id);
        const key = clustered ? `cluster:${clusterId}` : `event:${feature.properties.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        features.push({ feature, clustered, clusterId });
      }
      // All cluster lookups at once (they used to run one after another).
      const leaves = await Promise.all(features.map(({ clustered, clusterId }) => clustered && source
        ? source.getClusterLeaves(clusterId, 20, 0).then((items) => items.map((leaf) => ({ id: String(leaf.properties?.id || ""), title: String(leaf.properties?.title || "") }))).catch(() => [])
        : Promise.resolve([])));
      if (disposed || current !== generation) return;
      const occupied: { x: number; y: number; id: string }[] = [];
      const candidates: EventMapPoint[] = [];
      const seenPosters = new Set<string>();
      const nextGroups = new Map<string, MapPosterGroup>();
      const nextAnchors = new Map<string, EventMapPoint>();
      const nearby = new Set<string>();
      // The likely faces after the next zoom: the first leaves of each group.
      const next = new Set<string>();
      features.forEach(({ feature, clustered, clusterId }, index) => {
        if (feature.geometry.type !== "Point") return;
        let id = String(feature.properties.id || "");
        let titles = [String(feature.properties.title || "")];
        if (clustered) {
          const ids = leaves[index].map((leaf) => leaf.id).filter(Boolean);
          for (const leaf of ids) nearby.add(leaf);
          for (const leaf of ids.slice(0, 2)) next.add(leaf);
          // Keep a poster already on screen as the group's face, then one already loaded,
          // so a group does not switch to a poster that still has to load.
          id = ids.find((leaf) => anchors.has(leaf) && isReady(leaf) && !seenPosters.has(leaf))
            ?? ids.find((leaf) => isReady(leaf) && !seenPosters.has(leaf))
            ?? ids.find((leaf) => hasPoster(leaf) && !seenPosters.has(leaf))
            ?? ids.find((leaf) => !seenPosters.has(leaf)) ?? "";
          titles = leaves[index].slice(0, 5).map((leaf) => leaf.title);
        }
        const event = byId.get(id);
        // One poster per event: the bookkeeping below is keyed by event id.
        if (!event || seenPosters.has(id)) return;
        seenPosters.add(id);
        const anchor = { ...event, longitude: (feature.geometry as GeoJSON.Point).coordinates[0], latitude: (feature.geometry as GeoJSON.Point).coordinates[1] };
        const p = position(anchor);
        if (!p) return;
        const group: MapPosterGroup = { clusterIds: clustered ? [clusterId] : [], eventIds: clustered ? [] : [id], count: clustered ? Number(feature.properties.point_count) : 1, titles };
        const overlap = occupied.find((other) => Math.abs(other.x - p.x) < 64 && Math.abs(other.y - p.y) < 64);
        if (overlap) {
          // A poster replaces this screen area: retain every covered marker.
          const existing = nextGroups.get(overlap.id)!;
          existing.clusterIds.push(...group.clusterIds);
          existing.eventIds.push(...group.eventIds);
          existing.count += group.count;
          existing.titles = [...new Set([...existing.titles, ...group.titles])].slice(0, 5);
          return;
        }
        if (candidates.length >= MAX_POSTERS) return;
        occupied.push({ x: p.x, y: p.y, id });
        nextAnchors.set(id, anchor);
        nextGroups.set(id, group);
        candidates.push(event);
      });
      const show = () => {
        // Never rebuild under the user's finger: the next moveend brings a fresh layout.
        if (disposed || current !== generation || map.isMoving()) return;
        groups.current = nextGroups;
        positions.current = nextAnchors;
        // Posters that stay but move (a group split or merged) glide to their new spot.
        root.current?.classList.add("is-settling");
        clearTimeout(settle);
        settle = setTimeout(() => root.current?.classList.remove("is-settling"), 320);
        anchors.clear();
        for (const [id, anchor] of nextAnchors) anchors.set(id, anchor);
        setEvents(candidates.flatMap((event) => isReady(event.id) ? [cache.current.get(event.id)!.event!] : []));
        place();
      };
      // A face counts as settled once its data is here and its image (if any) is decoded.
      const settled = () => candidates.every((event) => { const cached = cache.current.get(event.id); return !!cached && cached.expires > Date.now() && (!cached.event?.poster || isReady(event.id)); });
      // Swap in one go: keep the posters on screen while the new ones load (at most 1.5 s),
      // instead of dropping to bare dots and popping posters back one by one. With nothing on
      // screen (a long pan, a filter change) there is nothing to keep: show what is ready now.
      if (settled() || !visible) show();
      else fallback = setTimeout(show, 1500);
      request = new AbortController();
      const { signal } = request;
      // Read ahead, alongside the faces and not cancelled by the next zoom: the rest of each
      // group's events, so when a zoom splits a group its new faces are usually ready already.
      // Kept small for phones: about two per group, and only images that are served resized.
      const ahead = [...next].filter((id) => !seenPosters.has(id) && !reading.has(id) && (cache.current.get(id)?.expires || 0) <= Date.now()).slice(0, 24);
      for (const id of ahead) reading.add(id);
      const warm = () => {
        for (const id of [...next].slice(0, 24)) {
          const event = hasPoster(id) && !isReady(id) ? cache.current.get(id)!.event! : null;
          if (event && posterSrc(event.poster, "thumb") !== event.poster) void preload(event);
        }
      };
      if (ahead.length) void fetchPosters(ahead, background.signal).then(warm, () => undefined).finally(() => { for (const id of ahead) reading.delete(id); });
      else warm();
      try {
        const missing = candidates.map((event) => event.id).filter((id) => (cache.current.get(id)?.expires || 0) <= Date.now());
        if (missing.length) await fetchPosters(missing, signal);
        if (disposed || current !== generation) return;
        const loading = candidates.filter((event) => hasPoster(event.id) && !isReady(event.id)).map((event) => cache.current.get(event.id)!.event!);
        if (loading.length) {
          let wait: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([Promise.all(loading.map(preload)), new Promise((resolve) => { wait = setTimeout(resolve, 2500); })]);
          clearTimeout(wait);
        }
        if (disposed || current !== generation) return;
        clearTimeout(fallback);
        show();
      } catch { /* Dots remain available if posters cannot load. */ } finally {
        // Keep browsing memory bounded even on long sessions.
        const keep = new Set([...candidates.map((event) => event.id), ...next]);
        for (const id of cache.current.keys()) {
          if (cache.current.size <= 400) break;
          if (!keep.has(id)) cache.current.delete(id);
        }
        if (ready.current.size > 800) ready.current.clear();
      }
    };
    function schedule() { clearTimeout(timer); timer = setTimeout(() => void refresh(), 160); }
    map.on("move", move);
    map.on("moveend", schedule);
    schedule();
    // New React markers are positioned before becoming visible.
    const observer = new MutationObserver(place);
    if (root.current) observer.observe(root.current, { childList: true });
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(settle);
      clearTimeout(fallback);
      cancelAnimationFrame(frame);
      request?.abort();
      background.abort();
      root.current?.classList.remove("is-settling");
      observer.disconnect();
      map.off("move", move);
      map.off("moveend", schedule);
    };
  }, [map, points]);

  return (
    <>
      <div ref={root} className="map-posters">
        {events.map((event) => (
          <a key={event.id} ref={(element) => { if (element) elements.current.set(event.id, element); else elements.current.delete(event.id); }}
            onMouseEnter={() => {
              const group = groups.current.get(event.id);
              const position = positions.current.get(event.id);
              if (group && group.count > 1 && position) onHoverGroup(group, [position.longitude, position.latitude]);
              onEventHighlight?.(event.id);
            }}
            onFocus={() => {
              const group = groups.current.get(event.id);
              const position = positions.current.get(event.id);
              if (group && group.count > 1 && position) onHoverGroup(group, [position.longitude, position.latitude]);
              onEventHighlight?.(event.id);
            }}
            onMouseLeave={() => { onLeaveGroup(); onEventHighlight?.(null); }}
            onBlur={() => { onLeaveGroup(); onEventHighlight?.(null); }}
            data-grouped={(groups.current.get(event.id)?.count || 0) > 1 || undefined}
            data-event-id={event.id}
            className={`map-poster${selectedEventId === event.id ? " is-selected" : ""}${highlightedId === event.id ? " is-highlighted" : ""}`} href={eventPath(event)} aria-label={(groups.current.get(event.id)?.count || 0) > 1 ? t("{count}개 행사 목록 보기", { count: groups.current.get(event.id)!.count }) : `${event.title}, ${t(eventDate(event))}`}
            onClick={(click) => {
              if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
              click.preventDefault();
              const group = groups.current.get(event.id);
              if (group && group.count > 1) { onOpenGroup(group); return; }
              if (onSelectEvent) { onSelectEvent(event); return; }
              opener.current = click.currentTarget;
              setSelected(event);
            }}>
            <img src={posterSrc(event.poster, "thumb")} width={48} height={48} alt="" decoding="async" onError={markerFallback(event.poster)} />
            {(groups.current.get(event.id)?.count || 0) > 1 && <span className="map-poster__count" aria-hidden="true">{groups.current.get(event.id)!.count}</span>}
            <span className="map-poster__info">
              {(groups.current.get(event.id)?.count || 0) > 1 && <strong>{groups.current.get(event.id)!.count}{t("개 행사 · 클릭하여 목록 보기")}</strong>}
              {(groups.current.get(event.id)?.count || 0) > 1
                ? <span className="map-poster__titles">{groups.current.get(event.id)!.titles.map((title, index) => <span key={`${index}:${title}`}>{title}</span>)}</span>
                : <strong>{event.title}</strong>}
              {(groups.current.get(event.id)?.count || 0) <= 1 && <>
                <span>{event.region}{event.venue && ` · ${event.venue}`}</span>
                <span>{t(eventDate(event))}</span>
              </>}
            </span>
          </a>
        ))}
      </div>
      {selected && <EventPosterDialog event={selected} opener={opener} onDismiss={() => setSelected(null)} />}
    </>
  );
}
