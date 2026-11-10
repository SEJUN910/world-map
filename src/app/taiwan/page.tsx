import { ExplorerPage, explorerMetadata, type ExplorerParams } from "@/lib/explorer-page";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<ExplorerParams> }) { return explorerMetadata("tw", await searchParams); }
export default async function Taiwan({ searchParams }: { searchParams: Promise<ExplorerParams> }) { return <ExplorerPage country="tw" params={await searchParams} />; }
