import { notFound, permanentRedirect } from "next/navigation";
import { eventPath } from "@/lib/events";
import { getPublicEvent } from "@/lib/event-repository";

// Compatibility only: event content lives in the explorer's modal.
export const dynamic = "force-dynamic";
export default async function LegacyEvent({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id } = await params;
  const event = await getPublicEvent(id);
  if (!event) notFound();
  permanentRedirect(eventPath(event));
}
