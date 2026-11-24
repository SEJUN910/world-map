import { countryByPath } from "./countries";
export function analyticsPath(path: string) { return path === "/" || countryByPath(path) ? path : path.startsWith("/regions/") ? "/regions" : null; }
export function isLocalHost(host: string) { return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host); }
