import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n/server";
import { getSavedEvents } from "@/lib/event-repository";
import { SavedEventsView } from "@/components/saved-events-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("관심 행사"), robots: { index: false, follow: false } };
}

export default async function SavedEventsPage() {
  const t = await getTranslations();
  const { user, active, ended, unavailableIds } = await getSavedEvents();
  return (
    <main id="main" className="shell drafts-page saved-page">
      <p className="eyebrow">SAVED EVENTS</p>
      <div className="section-heading">
        <h1>{t("관심 행사")}</h1>
      </div>
      <SavedEventsView active={active} ended={ended} unavailableIds={unavailableIds} member={!!user && !user.is_anonymous} />
    </main>
  );
}
