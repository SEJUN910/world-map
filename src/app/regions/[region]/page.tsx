import { ExplorerPage, explorerMetadata, type ExplorerParams } from "@/lib/explorer-page";
import { decodeRouteSegment } from "@/lib/events";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ region: string }>; searchParams: Promise<ExplorerParams> };
async function options({ params, searchParams }: Props) { const region = decodeRouteSegment((await params).region); return { params: { ...await searchParams, region, event: undefined }, path: `/regions/${encodeURIComponent(region)}` }; }
export async function generateMetadata(props: Props) { const value = await options(props); return explorerMetadata("kr", value.params, value.path); }
export default async function RegionPage(props: Props) { const value = await options(props); return <ExplorerPage country="kr" params={value.params} regionPath={value.path} />; }
