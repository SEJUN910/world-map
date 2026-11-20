"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body>
        <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: "1rem", fontFamily: "sans-serif", textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>페이지를 불러오지 못했어요.</h1>
          <p style={{ color: "#666" }}>새로고침하거나 잠시 후 다시 시도해 주세요.</p>
          <button onClick={reset} style={{ padding: "0.5rem 1.5rem", borderRadius: "0.5rem", border: "none", background: "#1a56db", color: "#fff", cursor: "pointer" }}>
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
