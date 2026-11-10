import { getTranslations } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftView } from "@/components/draft-view";
export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations(); return {
  title: t("브라우저에 남은 초안"),
  robots: { index: false, follow: false },
}; }
export default async function LocalDrafts({
  params,
}: {
  params: Promise<{ id?: string[] }>;
}) {
  const { id } = await params;
  if (id && id.length > 1) notFound();
  return (
    <main id="main">
      <DraftView id={id?.[0]} />
    </main>
  );
}
