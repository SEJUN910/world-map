import { ExplorerPage, explorerMetadata, type ExplorerParams } from "@/lib/explorer-page";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<ExplorerParams> }) { return explorerMetadata("fr", await searchParams); }
export default async function France({ searchParams }: { searchParams: Promise<ExplorerParams> }) { return <ExplorerPage country="fr" params={await searchParams} />; }
