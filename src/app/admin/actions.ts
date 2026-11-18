"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return null;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.id !== adminId) return null;
  return client;
}

export async function adminDeleteEventAction(eventId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return;
  const client = await requireAdmin();
  if (!client) return;
  await client.from("events").update({ publication_status: "deleted" }).eq("id", eventId);
  revalidatePath("/");
  revalidatePath("/korea");
  revalidatePath("/taiwan");
  revalidatePath("/admin");
}

export async function adminDismissReportAction(reportId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return;
  const client = await requireAdmin();
  if (!client) return;
  await client.from("reports").update({ status: "dismissed" }).eq("id", reportId);
  revalidatePath("/admin");
}
