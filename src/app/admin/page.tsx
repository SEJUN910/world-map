import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminDeleteEventAction, adminDismissReportAction } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

async function requireAdmin() {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) notFound();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.id !== adminId) notFound();
  return client;
}

type ReportRow = { id: string; reason: string; created_at: string; status: string; events: { id: string; title: string; publication_status: string } | null };
type EventRow = { id: string; title: string; publication_status: string; created_at: string; country_code: string };

export default async function AdminPage() {
  const client = await requireAdmin();

  const [{ data: reports }, { data: events }] = await Promise.all([
    client.from("reports").select("id,reason,created_at,status,events(id,title,publication_status)")
      .eq("status", "pending").order("created_at", { ascending: false }).limit(100),
    client.from("events").select("id,title,publication_status,created_at,country_code")
      .order("created_at", { ascending: false }).limit(50),
  ]);

  const typedReports = (reports ?? []) as ReportRow[];
  const typedEvents = (events ?? []) as EventRow[];

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "2rem" }}>festiva admin</h1>

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
                    <form action={adminDismissReportAction.bind(null, r.id)}>
                      <button type="submit" style={{ background: "#eee", border: "none", borderRadius: "4px", padding: "0.25rem 0.75rem", cursor: "pointer", fontSize: "0.8rem" }}>무시</button>
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
                  <Link href={`/${e.country_code === "tw" ? "taiwan" : "korea"}?event=${e.id}`} target="_blank" style={{ color: "#1a56db" }}>{e.title}</Link>
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
    </main>
  );
}
