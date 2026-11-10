import { getTranslations } from "@/lib/i18n/server";
import { RichTextView } from "@/components/rich-text-view";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyEvent } from "@/lib/event-repository";
import { createClient } from "@/lib/supabase/server";
import { eventDate, eventPath } from "@/lib/events";
import { EventControls } from "@/components/event-controls";
export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations(); return {
  title: t("내 행사 관리"),
  robots: { index: false, follow: false },
}; }
export default async function MyEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) notFound();
  const event = await getMyEvent(id);
  if (!event) notFound();
  return (
    <main id="main" className="shell drafts-page">
      <Link className="text-link" href="/me/events">
        {t("← 내 행사")}</Link>
      <div className="detail-layout">
        <div className="detail-poster">
          {event.poster ? (
            <img
              src={event.poster}
              alt={`${event.title} 포스터`}
              width={480}
              height={680}
            />
          ) : (
            <p className="empty-state">{t("포스터를 추가해주세요.")}</p>
          )}
        </div>
        <article className="detail-copy">
          <p className="eyebrow">
            {event.publicationStatus === "published"
              ? t("공개 중")
              : event.publicationStatus === "hidden"
                ? t("숨김 처리")
                : t("비공개 저장")}{" "}
            · {event.region}
          </p>
          <h1>{event.title}</h1>
          <dl className="event-facts">
            <div>
              <dt>{t("일정")}</dt>
              <dd>{t(eventDate(event))}</dd>
            </div>
            <div>
              <dt>{t("장소")}</dt>
              <dd>
                {event.venue}
                <br />
                {event.address}
              </dd>
            </div>
          </dl>
          <RichTextView content={event.descriptionContent} text={event.description} />
          {event.publicationStatus === "published" && (
            <Link className="text-link" href={eventPath(event)}>
              {t("공개 페이지 보기 ↗")}</Link>
          )}
          <EventControls id={id} status={event.publicationStatus} />
        </article>
      </div>
    </main>
  );
}
