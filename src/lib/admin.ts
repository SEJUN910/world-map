import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Single admin check shared by /admin and its server actions.
 * Both conditions are required so the page only opens when RLS will also allow
 * the writes: public.is_admin() reads JWT app_metadata.role = 'admin', and
 * ADMIN_USER_ID pins the panel to one account. getUser() verifies the session
 * with the Auth server, so app_metadata here is trustworthy.
 */
export async function requireAdmin() {
  const adminId = process.env.ADMIN_USER_ID?.trim();
  if (!adminId) return null;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.id !== adminId || user.app_metadata?.role !== "admin") return null;
  return client;
}
