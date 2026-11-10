import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment is missing");
if (!key.startsWith("sb_publishable_"))
  throw new Error("Expected a publishable API key");
const response = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: key },
});
if (!response.ok)
  throw new Error(`Supabase Auth check failed: ${response.status}`);
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.auth.getSession();
if (error) throw new Error("Supabase client initialization failed");
if (data.session !== null) throw new Error("Unexpected session in setup check");
// The Data API root's OpenAPI document requires a secret key. Check a normal
// public data endpoint instead and require the migrated events table to exist.
const { error: dataError } = await supabase
  .from("events")
  .select("id")
  .limit(0);
if (dataError) {
  throw new Error(`Supabase Data API check failed: ${dataError.code}`);
}
console.log(
  "PASS Supabase Auth, Data API authentication and SDK initialization",
);
console.log(`Project: ${new URL(url).hostname.split(".")[0]}`);
