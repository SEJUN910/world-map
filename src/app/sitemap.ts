import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/event-repository";
import { todayInCountry } from "@/lib/events";
import { absoluteUrl, localizedPath, localeAlternates } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = ["/", "/korea", "/taiwan"].map((path) => ({ url: absoluteUrl(localizedPath(path,"ko")), alternates: { languages: localeAlternates(path) } }));
  const client = publicClient();
  const regions = new Map<string,string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("events").select("id,country_code,region_code,region,updated_at")
      .eq("publication_status","published")
      .or(`end_date.is.null,and(country_code.eq.kr,end_date.gte.${todayInCountry("kr")}),and(country_code.eq.tw,end_date.gte.${todayInCountry("tw")})`)
      .order("id").range(offset,offset+999);
    if (error) throw Error("Could not generate sitemap");
    for (const event of data || []) {
      const path = event.country_code === "tw" ? "/taiwan" : "/korea";
      const values = { event: event.id };
      entries.push({ url: absoluteUrl(localizedPath(path,"ko",values)), lastModified: event.updated_at, alternates: { languages: localeAlternates(path,values) } });
      if (event.country_code === "kr" && event.region.trim()) {
        const regionPath = `/regions/${encodeURIComponent(event.region_code)}`;
        if (!regions.has(regionPath) || regions.get(regionPath)! < event.updated_at) regions.set(regionPath,event.updated_at);
      }
    }
    if (!data || data.length < 1000) break;
  }
  for (const [path,lastModified] of regions) entries.push({ url: absoluteUrl(localizedPath(path,"ko")), lastModified, alternates: { languages: localeAlternates(path) } });
  if (entries.length > 50000) throw Error("Sitemap requires partitioning");
  return entries;
}
