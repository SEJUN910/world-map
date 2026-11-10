import { ExplorerPage, explorerMetadata, type ExplorerParams } from "@/lib/explorer-page";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<ExplorerParams> }) { return explorerMetadata("kr", await searchParams); }
export default async function Korea({ searchParams }: { searchParams: Promise<ExplorerParams> }) { return <ExplorerPage country="kr" params={await searchParams} />; }
