import { ImageResponse } from "next/og";
export const runtime = "nodejs";
export async function GET() {
  return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#fff", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#234c87", backgroundImage: "linear-gradient(#eaf2ff 1px, transparent 1px), linear-gradient(90deg, #eaf2ff 1px, transparent 1px)", backgroundSize: "80px 80px" }}>
    <div style={{ display: "flex", fontSize: 112, letterSpacing: -6 }}>festiva<span style={{ color: "#3478dd", marginLeft: 16 }}>✳</span></div>
    <div style={{ display: "flex", marginTop: 22, fontSize: 30, letterSpacing: 2, color: "#6581a8" }}>Local festivals. Global discoveries.</div>
    <div style={{ display: "flex", marginTop: 48, width: 120, height: 120, border: "2px solid #7ba6e8", borderRadius: "50%", alignItems: "center", justifyContent: "center" }}><div style={{ display: "flex", width: 54, height: 120, border: "1px solid #7ba6e8", borderRadius: "50%" }} /></div>
  </div>, { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } });
}
