import { getTranslations } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyEvent } from "@/lib/event-repository";
import { EventForm } from "@/components/event-form";
export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations(); return {
  title: t("행사 수정"),
  robots: { index: false, follow: false },
}; }
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) notFound();
  const event = await getMyEvent(id);
  if (!event || !["draft", "published"].includes(event.publicationStatus))
    notFound();
  return (
    <main id="main">
      <EventForm key={event.id} existing={event} />
    </main>
  );
}
