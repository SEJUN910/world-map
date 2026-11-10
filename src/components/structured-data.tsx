import { serializeJsonLd } from "@/lib/seo";
export function StructuredData({ value }: { value: unknown }) { return value ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(value) }} /> : null; }
