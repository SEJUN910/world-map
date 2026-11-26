import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { adminDeleteEventAction, adminResolveReportAction } from "./actions";
import Link from "next/link";
import { countries, isCountryCode } from "@/lib/countries";
import { countryName } from "@/lib/requestable-countries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

const RESULTS: Record<string, { text: string; failed: boolean }> = {
  deleted: { text: "행사를 삭제했어요.", failed: false },
  resolved: { text: "신고를 처리 완료로 바꿨어요.", failed: false },
  "delete-failed": { text: "행사를 삭제하지 못했어요. 이미 처리됐거나 관리자 권한(app_metadata.role)이 없는지 확인해주세요.", failed: true },
  "resolve-failed": { text: "신고를 처리 완료로 바꾸지 못했어요. 이미 처리됐거나 관리자 권한(app_metadata.role)이 없는지 확인해주세요.", failed: true },
  forbidden: { text: "관리자 권한이 확인되지 않아 처리하지 못했어요. 다시 로그인해주세요.", failed: true },
};

type ReportRow = { id: string; reason: string; created_at: string; status: string; events: { id: string; title: string; publication_status: string } | null };
type EventRow = { id: string; title: string; publication_status: string; created_at: string; country_code: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ result?: string | string[]; reqSort?: string | string[] }> }) {
  const client = await requireAdmin();
  if (!client) notFound();
  const { result: resultParam, reqSort } = await searchParams;
  const sortRecent = reqSort === "30d";
  const result = typeof resultParam === "string" ? RESULTS[resultParam] : undefined;

  const [{ data: reports, error: reportsError }, { data: events, error: eventsError }, { data: requests, error: requestsError }] = await Promise.all([
    client.from("reports").select("id,reason,created_at,status,events(id,title,publication_status)")
      .eq("status", "open").order("created_at", { ascending: false }).limit(100),
    client.from("events").select("id,title,publication_status,created_at,country_code")
      .order("created_at", { ascending: false }).limit(50),
    client.rpc("country_request_summary"),
  ]);
  // Requested countries, most wanted first (all time or the last 30 days).
  const requestRows = [...(requests ?? [])].sort((a, b) => sortRecent
    ? Number(b.recent_count) - Number(a.recent_count) || Number(b.total_count) - Number(a.total_count)
    : Number(b.total_count) - Number(a.total_count) || Number(b.recent_count) - Number(a.recent_count));

  const typedReports = (reports ?? []) as ReportRow[];
  const typedEvents = (events ?? []) as EventRow[];

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "2rem" }}>LukeMap admin</h1>
      {result && (
        <p role={result.failed ? "alert" : "status"} style={{ padding: "0.75rem 1rem", marginBottom: "1.5rem", borderRadius: "6px", background: result.failed ? "#fdecec" : "#eaf6ec", color: result.failed ? "#a00" : "#0a5c1f" }}>
          {result.text}
        </p>
      )}
      {(reportsError || eventsError) && (
        <p role="alert" style={{ padding: "0.75rem 1rem", marginBottom: "1.5rem", borderRadius: "6px", background: "#fdecec", color: "#a00" }}>
          목록을 불러오지 못했어요. 잠시 후 새로고침해주세요.
        </p>
      )}

      <section>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>신고 대기 ({typedReports.length})</h2>
        {typedReports.length === 0 ? (
          <p style={{ color: "#666" }}>신고 없음</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>행사</th>
                <th style={{ padding: "0.5rem" }}>신고 사유</th>
                <th style={{ padding: "0.5rem" }}>일시</th>
                <th style={{ padding: "0.5rem" }}>상태</th>
                <th style={{ padding: "0.5rem" }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {typedReports.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "0.5rem" }}>
                    {r.events ? (
                      <span>
                        <span style={{ opacity: 0.5, marginRight: "0.25rem", fontSize: "0.75rem" }}>[{r.events.publication_status}]</span>
                        {r.events.title}
                      </span>
                    ) : <span style={{ color: "#999" }}>삭제된 행사</span>}
                  </td>
                  <td style={{ padding: "0.5rem", maxWidth: "240px" }}>{r.reason}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap", color: "#666" }}>{r.created_at.slice(0, 10)}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <span style={{ color: r.events?.publication_status === "published" ? "#c00" : "#888" }}>
                      {r.events?.publication_status ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {r.events && r.events.publication_status !== "deleted" && (
                      <form action={adminDeleteEventAction.bind(null, r.events.id)}>
                        <button type="submit" style={{ background: "#c00", color: "#fff", border: "none", borderRadius: "4px", padding: "0.25rem 0.75rem", cursor: "pointer", fontSize: "0.8rem" }}>삭제</button>
                      </form>
                    )}
                    <form action={adminResolveReportAction.bind(null, r.id)}>
                      <button type="submit" style={{ background: "#eee", border: "none", borderRadius: "4px", padding: "0.25rem 0.75rem", cursor: "pointer", fontSize: "0.8rem" }}>처리 완료</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>최근 행사 (50개)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
              <th style={{ padding: "0.5rem" }}>제목</th>
              <th style={{ padding: "0.5rem" }}>국가</th>
              <th style={{ padding: "0.5rem" }}>상태</th>
              <th style={{ padding: "0.5rem" }}>등록일</th>
              <th style={{ padding: "0.5rem" }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {typedEvents.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "0.5rem" }}>
                  <Link href={`${countries[isCountryCode(e.country_code) ? e.country_code : "kr"].path}?event=${e.id}`} target="_blank" style={{ color: "#1a56db" }}>{e.title}</Link>
                </td>
                <td style={{ padding: "0.5rem" }}>{e.country_code?.toUpperCase()}</td>
                <td style={{ padding: "0.5rem", color: e.publication_status === "published" ? "#090" : e.publication_status === "deleted" ? "#999" : "#a60" }}>{e.publication_status}</td>
                <td style={{ padding: "0.5rem", color: "#666" }}>{e.created_at.slice(0, 10)}</td>
                <td style={{ padding: "0.5rem" }}>
                  {e.publication_status !== "deleted" && (
                    <form action={adminDeleteEventAction.bind(null, e.id)}>
                      <button type="submit" style={{ background: "#fee", border: "1px solid #c00", color: "#c00", borderRadius: "4px", padding: "0.25rem 0.75rem", cursor: "pointer", fontSize: "0.8rem" }}>삭제</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section style={{ marginTop: "3rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>나라 추가 요청 ({requestRows.length}개국)</h2>
        <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
          정렬: <Link href="/admin" style={{ fontWeight: sortRecent ? 400 : 700 }}>전체순</Link> · <Link href="/admin?reqSort=30d" style={{ fontWeight: sortRecent ? 700 : 400 }}>최근 30일순</Link>
        </p>
        {requestsError ? <p role="alert" style={{ color: "#a00" }}>요청 집계를 불러오지 못했어요.</p> : requestRows.length === 0 ? (
          <p style={{ color: "#666" }}>아직 요청 없음</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>순위</th><th style={{ padding: "0.5rem" }}>나라</th>
                <th style={{ padding: "0.5rem" }}>전체</th><th style={{ padding: "0.5rem" }}>최근 30일</th><th style={{ padding: "0.5rem" }}>마지막 요청</th>
              </tr>
            </thead>
            <tbody>
              {requestRows.map((row, index) => (
                <tr key={row.country_code} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "0.5rem" }}>{index + 1}</td>
                  <td style={{ padding: "0.5rem" }}>{countryName(row.country_code, "ko")} <span style={{ color: "#999" }}>{row.country_code}</span></td>
                  <td style={{ padding: "0.5rem" }}>{row.total_count}</td>
                  <td style={{ padding: "0.5rem" }}>{row.recent_count}</td>
                  <td style={{ padding: "0.5rem", color: "#666" }}>{row.last_requested_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
