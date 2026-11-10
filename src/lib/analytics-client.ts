"use client";
import { analyticsPath } from "./analytics-path";
import type { Locale } from "./i18n";
let lastPage = "";
let pending = Promise.resolve();
const viewedEvents = new Map<string, number>();
export function sendAnalytics(kind: "page_view" | "event_view", locale: Locale, eventId: string | null = null) {
  if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  const path = analyticsPath(location.pathname);
  if (!path || document.visibilityState !== "visible") return;
  if (kind === "page_view") { if (lastPage === location.pathname) return; lastPage = location.pathname; }
  else if (eventId) {
    const last = viewedEvents.get(eventId) || 0;
    if (Date.now() - last < 30 * 60_000) return;
    viewedEvents.set(eventId, Date.now());
    if (viewedEvents.size > 500) viewedEvents.delete(viewedEvents.keys().next().value!);
  }
  let referrer = "";
  try { const url = new URL(document.referrer); if (url.host !== location.host) referrer = url.hostname; } catch { /* Direct visit */ }
  const body = JSON.stringify({ id: crypto.randomUUID(), kind, eventId, path, country: path === "/taiwan" ? "tw" : path === "/korea" || path === "/regions" ? "kr" : null, locale, referrer });
  pending = pending.then(() => fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })).then(() => {}).catch(() => { /* Analytics must never block the UI. */ });
}
export function leaveAnalyticsPage() { lastPage = ""; }
