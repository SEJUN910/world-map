import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";
import { isLocale } from "@/lib/i18n";
import { searchIndexingEnabled } from "@/lib/site";

export async function proxy(request: NextRequest) {
  // Always overwrite this internal header; never trust one sent by a client.
  const locale = request.nextUrl.searchParams.get("lang");
  request.headers.delete("x-festiva-locale");
  if (isLocale(locale)) request.headers.set("x-festiva-locale", locale);
  const response = await updateSession(request);
  if (!searchIndexingEnabled) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|robots.txt|sitemap.xml).*)",
  ],
};
