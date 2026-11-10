"use client";
import { useTranslations } from "@/components/language-provider";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { eventDate, eventPath, type FestivalEvent } from "@/lib/events";
import type { EventMapPoint } from "./event-map";
import { EventPosterDialog } from "./event-poster-dialog";

export type MapPosterGroup = { clusterIds: number[]; eventIds: string[]; count: number; titles: string[] };

const START_ZOOM = 6;
const FULL_ZOOM = 7;
const MAX_POSTERS = 36;

export function EventMapPosters({ map, points, onOpenGroup, onHoverGroup, onLeaveGroup }: { map: MapLibreMap; points: EventMapPoint[]; onOpenGroup: (group: MapPosterGroup) => void; onHoverGroup: (group: MapPosterGroup, position: [number, number]) => void; onLeaveGroup: () => void }) {
  const { t } = useTranslations();
  const root = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLAnchorElement>());
  const cache = useRef(new Map<string, { event: FestivalEvent; expires: number }>());
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
      for (const [id, element] of elements.current) {
        const event = anchors.get(id);
        const p = event ? position(event) : null;
        element.style.visibility = p && opacity > 0 ? "visible" : "hidden";
        element.style.pointerEvents = p && opacity > 0.12 ? "auto" : "none";
        if (p) {
          element.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
          element.classList.toggle("is-near-right", p.x > map.getContainer().clientWidth - 240);
        }
      }
    };
    const move = () => {
      if (!frame) frame = requestAnimationFrame(place);
      const close = map.getZoom() >= START_ZOOM;
      if (close !== wasClose) { wasClose = close; schedule(); }
    };
    const refresh = async () => {
      const current = ++generation;
      request?.abort();
      if (map.getZoom() < START_ZOOM) { setEvents([]); return; }
      const occupied: { x: number; y: number; id: string }[] = [];
      const candidates: EventMapPoint[] = [];
      const seen = new Set<string>();
      const nextGroups = new Map<string, MapPosterGroup>();
      const nextAnchors = new Map<string, EventMapPoint>();
      const features = map.queryRenderedFeatures({ layers: ["event-clusters", "event-points"] });
      for (const feature of features) {
        if (feature.geometry.type !== "Point") continue;
        const clustered = !!feature.properties.cluster;
        const clusterId = Number(feature.properties.cluster_id);
        const key = clustered ? `cluster:${clusterId}` : `event:${feature.properties.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let id = String(feature.properties.id || "");
        let titles = [String(feature.properties.title || "")];
        if (clustered) {
          const leaves = await (map.getSource("events") as GeoJSONSource).getClusterLeaves(clusterId, 5, 0).catch(() => []);
          id = String(leaves[0]?.properties?.id || "");
          titles = leaves.map((leaf) => String(leaf.properties?.title || ""));
        }
        if (disposed || current !== generation) return;
        const event = byId.get(id);
        if (!event) continue;
        const anchor = { ...event, longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] };
        const p = position(anchor);
        if (!p) continue;
        const group: MapPosterGroup = { clusterIds: clustered ? [clusterId] : [], eventIds: clustered ? [] : [id], count: clustered ? Number(feature.properties.point_count) : 1, titles };
        const overlap = occupied.find((other) => Math.abs(other.x - p.x) < 64 && Math.abs(other.y - p.y) < 64);
        if (overlap) {
          // A poster replaces this screen area: retain every covered marker.
          const existing = nextGroups.get(overlap.id)!;
          existing.clusterIds.push(...group.clusterIds);
          existing.eventIds.push(...group.eventIds);
          existing.count += group.count;
          existing.titles = [...new Set([...existing.titles, ...group.titles])].slice(0, 5);
          continue;
        }
        if (candidates.length >= MAX_POSTERS) continue;
        occupied.push({ x: p.x, y: p.y, id });
        nextAnchors.set(id, anchor);
        nextGroups.set(id, group);
        candidates.push(event);
      }
      const show = () => {
        if (disposed || current !== generation) return;
        groups.current = nextGroups;
        positions.current = nextAnchors;
        anchors.clear();
        for (const [id, anchor] of nextAnchors) anchors.set(id, anchor);
        setEvents(candidates.flatMap((event) => {
          const cached = cache.current.get(event.id);
          return cached && cached.expires > Date.now() && cached.event.poster ? [cached.event] : [];
        }));
        place();
      };
      show();
      const missing = candidates.filter((event) => (cache.current.get(event.id)?.expires || 0) <= Date.now());
      if (!missing.length) return;
      request = new AbortController();
      try {
        const response = await fetch(`/api/map-posters?ids=${missing.map((event) => event.id).join(",")}`, { signal: request.signal });
        if (!response.ok) return;
        const data: FestivalEvent[] = await response.json();
        if (disposed || current !== generation) return;
        for (const event of data) cache.current.set(event.id, { event, expires: Date.now() + 240_000 });
        // Keep browsing memory bounded even on long sessions.
        const visibleIds = new Set(candidates.map((event) => event.id));
        for (const id of cache.current.keys()) {
          if (cache.current.size <= 128) break;
          if (!visibleIds.has(id)) cache.current.delete(id);
        }
        show();
      } catch { /* Dots remain available if posters cannot load. */ }
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
      cancelAnimationFrame(frame);
      request?.abort();
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
            }}
            onFocus={() => {
              const group = groups.current.get(event.id);
              const position = positions.current.get(event.id);
              if (group && group.count > 1 && position) onHoverGroup(group, [position.longitude, position.latitude]);
            }}
            onMouseLeave={onLeaveGroup} onBlur={onLeaveGroup}
            data-grouped={(groups.current.get(event.id)?.count || 0) > 1 || undefined}
            className="map-poster" href={eventPath(event)} aria-label={(groups.current.get(event.id)?.count || 0) > 1 ? t("{count}개 행사 목록 보기", { count: groups.current.get(event.id)!.count }) : `${event.title}, ${t(eventDate(event))}`}
            onClick={(click) => {
              if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
              click.preventDefault();
              const group = groups.current.get(event.id);
              if (group && group.count > 1) { onOpenGroup(group); return; }
              opener.current = click.currentTarget;
              setSelected(event);
            }}>
            <img src={event.poster} width={48} height={48} alt="" decoding="async" onError={(e) => { e.currentTarget.closest<HTMLElement>(".map-poster")!.style.display = "none"; }} />
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
