"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

const UUID = /^[0-9a-f-]{36}$/i;

// RLS silently filters rows it does not allow, so a 0-row update is a failure too.
export async function adminDeleteEventAction(eventId: string): Promise<void> {
  if (!UUID.test(eventId)) redirect("/admin?result=delete-failed");
  const client = await requireAdmin();
  if (!client) redirect("/admin?result=forbidden");
  const { data, error } = await client.from("events").update({ publication_status: "deleted" }).eq("id", eventId).select("id");
  if (error || !data?.length) {
    if (error) console.error("[admin] delete event failed", error.code);
    redirect("/admin?result=delete-failed");
  }
  revalidatePath("/");
  revalidatePath("/korea");
  revalidatePath("/taiwan");
  revalidatePath("/admin");
  redirect("/admin?result=deleted");
}

export async function adminResolveReportAction(reportId: string): Promise<void> {
  if (!UUID.test(reportId)) redirect("/admin?result=resolve-failed");
  const client = await requireAdmin();
  if (!client) redirect("/admin?result=forbidden");
  // reports.status only allows 'open' | 'resolved' (202611040001_initial_events.sql).
  const { data, error } = await client.from("reports").update({ status: "resolved" }).eq("id", reportId).select("id");
  if (error || !data?.length) {
    if (error) console.error("[admin] resolve report failed", error.code);
    redirect("/admin?result=resolve-failed");
  }
  revalidatePath("/admin");
  redirect("/admin?result=resolved");
}
