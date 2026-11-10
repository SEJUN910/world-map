export function safeAuthReturn(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/me/events";
  try {
    const url = new URL(value,"https://festiva.invalid");
    if (url.origin!=="https://festiva.invalid" || !/^\/(?:$|korea\/?$|taiwan\/?$|regions\/[^/]+\/?$|me\/events(?:\/[^/]+)?\/?$|events\/[^/]+\/edit\/?$)/.test(url.pathname)) return "/me/events";
    url.searchParams.delete("code"); url.searchParams.delete("error"); url.searchParams.delete("error_description");
    return `${url.pathname}${url.search}`;
  } catch { return "/me/events"; }
}
export const handoffCookie = "festiva-account-handoff";
// Public redirects always use the configured origin. Only a local development
// Host may override it; forwarded host headers are never used.
export function authOrigin(canonical: string, host: string | null, local: boolean) {
  if (local && host && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)) return `http://${host}`;
  return canonical;
}
export function isGoogleMember(user: { is_anonymous?: boolean; app_metadata?: { providers?: string[]; provider?: string } } | null) {
  return !!user && !user.is_anonymous && (user.app_metadata?.provider === "google" || !!user.app_metadata?.providers?.includes("google"));
}
