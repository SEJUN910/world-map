import { getTranslations } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { getMyEvents } from "@/lib/event-repository";
import { eventDate } from "@/lib/events";
import { EventCreateButton } from "@/components/event-create-button";
import { createClient } from "@/lib/supabase/server";
export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations(); return {
  title: t("내 행사"),
  robots: { index: false, follow: false },
}; }
export default async function MyEvents() {
  const t = await getTranslations();
  const { events } = await getMyEvents();
  const { data: { user } } = await (await createClient()).auth.getUser();
  return (
    <main id="main" className="shell drafts-page">
      <p className="eyebrow">MY LOCAL DISCOVERIES</p>
      <div className="section-heading">
        <h1>{t("내가 모아둔 발견.")}</h1>
        <EventCreateButton className="button">
          {t("새 행사 올리기 ＋")}</EventCreateButton>
      </div>
      <p className="sample-banner">
        {user && !user.is_anonymous ? t("계정에 저장한 행사는 다른 기기에서도 관리할 수 있어요.") : t("가입 없이 올릴 수 있어요. Google로 로그인하면 이 브라우저에서 올린 행사도 계정에 연결됩니다. 로그인 전에는 브라우저 데이터를 지우면 수정 권한을 잃을 수 있어요.")}{" "}
        <Link href="/me/local-drafts" className="text-link">
          {t("이 브라우저에 남은 이전 초안 보기 ↗")}</Link>
      </p>
      {events.length ? (
        <div className="event-grid">
          {events.map((event) => (
            <article key={event.id} className="event-card">
              <Link href={`/me/events/${event.id}`}>
                <div className="poster-frame">
                  {event.poster ? (
                    <img
                      src={event.poster}
                      alt={`${event.title} 포스터`}
                      width={480}
                      height={680}
                    />
                  ) : (
                    <span className="poster-placeholder">
                      {t("포스터를 추가해주세요")}</span>
                  )}
                </div>
                <div className="card-meta">
                  <span>{event.region}</span>
                  <span>
                    {event.publicationStatus === "published"
                      ? t("공개 중")
                      : event.publicationStatus === "hidden"
                        ? t("관리자 숨김")
                        : t("비공개 저장")}
                  </span>
                </div>
                <h2>{event.title}</h2>
                <p className="fine-print">{t(eventDate(event))}</p>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{t("첫 발견을 기다리고 있어요.")}</h2>
          <EventCreateButton className="button">
            {t("행사 올리기 ＋")}</EventCreateButton>
        </div>
      )}
    </main>
  );
}
