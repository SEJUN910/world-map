import { getImageProps } from "next/image";
import type { SyntheticEvent } from "react";
import { isResizablePoster } from "./poster-hosts";

// Small poster URLs for lists, map markers and cards. Width and quality match
// next.config.ts images (imageSizes [192], deviceSizes [384], qualities [70]),
// so each image has exactly one cached variant per size: "thumb" (84px list
// rows and 48px markers share w=192) and "card" (w=384).
const SIZES = { thumb: { width: 84, height: 112 }, card: { width: 240, height: 340 } } as const;

export function posterSrc(url: string, size: keyof typeof SIZES): string {
  if (!url || !isResizablePoster(url)) return url;
  return getImageProps({ src: url, alt: "", quality: 70, ...SIZES[size] }).props.src;
}

function swapToOriginal(img: HTMLImageElement, original: string) {
  if (!original || img.dataset.original || img.getAttribute("src") === original) return;
  img.dataset.original = "1";
  img.src = original;
}

/**
 * Props for a resized poster <img>: on failure, retry once with the original
 * URL. The ref covers server-rendered images that failed before hydration,
 * whose error event React never sees.
 */
export function fallBackToOriginal(original: string) {
  return {
    onError: (event: SyntheticEvent<HTMLImageElement>) => swapToOriginal(event.currentTarget, original),
    // currentSrc stays empty until a request starts, so deferred lazy images are left alone.
    ref: (img: HTMLImageElement | null) => { if (img && img.complete && img.naturalWidth === 0 && img.currentSrc) swapToOriginal(img, original); },
  };
}

/** onError for a map marker: retry once with the original, then hide the marker. */
export function markerFallback(original: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (original && !img.dataset.original && img.getAttribute("src") !== original) { swapToOriginal(img, original); return; }
    img.closest<HTMLElement>(".map-poster")!.style.display = "none";
  };
}
