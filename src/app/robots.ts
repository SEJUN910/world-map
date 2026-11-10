import type { MetadataRoute } from "next";
import { siteUrl, searchIndexingEnabled } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: searchIndexingEnabled ? "/" : undefined,
      disallow: searchIndexingEnabled ? ["/me/", "/admin", "/api/", "/auth/"] : "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
