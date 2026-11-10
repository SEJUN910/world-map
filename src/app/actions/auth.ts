"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authOrigin, handoffCookie, safeAuthReturn } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
export async function startGoogleAuth(form: FormData) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const next = safeAuthReturn(form.get("next"));
  const mode = form.get("mode") === "existing" ? "existing" : "link";
  if (process.env.GOOGLE_AUTH_ENABLED !== "true") redirect("/auth/error?reason=unavailable");
  const h = await headers();
  const origin = authOrigin(siteUrl,h.get("host"),!process.env.VERCEL);
  const callback = new URL("/auth/callback",origin); callback.searchParams.set("next",next);
  if (user?.is_anonymous) {
    const { data, error } = await client.rpc("begin_event_account_handoff");
    if (error || !data) redirect("/auth/error?reason=handoff");
    (await cookies()).set(handoffCookie,data,{httpOnly:true,sameSite:"lax",secure:origin.startsWith("https:"),path:"/auth",maxAge:1800});
  }
  const options = { redirectTo: callback.href, skipBrowserRedirect: true, scopes:"openid email profile", queryParams: { prompt:"select_account" } };
  // Linking preserves the anonymous ID for a first-time Google signup. If the
  // identity already exists, a deliberate retry signs in then redeems the proof.
  const result = user?.is_anonymous && mode !== "existing" ? await client.auth.linkIdentity({provider:"google",options}) : await client.auth.signInWithOAuth({provider:"google",options});
  if (result.error || !result.data.url) redirect(`/auth/error?reason=${result.error?.code === "identity_already_exists" || result.error?.code === "identity_already_linked" ? "existing" : "callback"}`);
  redirect(result.data.url);
}
export async function signOutAccount() {
  const client=await createClient(); const { data:{user} }=await client.auth.getUser();
  if (user && !user.is_anonymous) {
    const {error}=await client.auth.signOut({scope:"local"});
    if(error) redirect("/auth/error?reason=callback");
    (await cookies()).delete({name:handoffCookie,path:"/auth"});
  }
  redirect("/");
}
