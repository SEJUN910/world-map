import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Google members keep their identity; guests get a session on their first write.
export async function ensureVisitor(client: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) return user;
  const { data, error } = await client.auth.signInAnonymously();
  return error ? null : data.user;
}
