"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FestivalEvent } from "@/lib/events";

// One page (24) of the events in a map selection: reuse what the current list
// page already has, fetch the rest from /api/map-posters. A newer selection or
// page aborts the older request, so a slow answer never overwrites it.
// The desktop list uses this; the mobile sheet keeps its own copy of the same logic.
export function useGroupEvents(selectedIds: string[] | null, events: FestivalEvent[]) {
  // The page belongs to one selection, so a new selection starts at page 0 in
  // the same render (no frame with the previous group's page index).
  const [paging, setPaging] = useState<{ ids: string[] | null; page: number }>({ ids: null, page: 0 });
  const groupPage = paging.ids === selectedIds ? paging.page : 0;
  const setGroupPage = (update: (page: number) => number) => setPaging({ ids: selectedIds, page: update(groupPage) });
  // Rows are tagged with the selection and page they were loaded for; anything
  // else counts as loading, so the previous group's rows never show under the new header.
  const [loaded, setLoaded] = useState<{ ids: string[] | null; page: number; events: FestivalEvent[] } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  // Only a different set of list events matters, not a new array with the same rows.
  const latestEvents = useRef(events); latestEvents.current = events;
  const eventsKey = events.map(event => event.id).join(",");
  const known = useMemo(() => new Map(latestEvents.current.map(event => [event.id, event])), [eventsKey]);
  useEffect(() => {
    setError(false);
    if (!selectedIds) { setLoaded(null); return; }
    const ids = selectedIds.slice(groupPage * 24, (groupPage + 1) * 24);
    const missing = ids.filter(id => !known.has(id));
    if (!missing.length) { setLoaded({ ids: selectedIds, page: groupPage, events: ids.map(id => known.get(id)!) }); return; }
    const controller = new AbortController();
    fetch(`/api/map-posters?ids=${missing.join(",")}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<FestivalEvent[]>; })
      .then(data => {
        if (controller.signal.aborted) return;
        const byId = new Map([...known, ...data.map(event => [event.id, event] as const)]);
        setLoaded({ ids: selectedIds, page: groupPage, events: ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []) });
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [selectedIds, groupPage, retry, known]);
  const current = !!selectedIds && loaded?.ids === selectedIds && loaded.page === groupPage;
  return {
    groupPage, setGroupPage,
    groupEvents: current ? loaded!.events : [],
    loading: !!selectedIds && !current && !error,
    error: !!selectedIds && error,
    retry: () => setRetry(value => value + 1),
  };
}
