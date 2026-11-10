import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authOrigin, handoffCookie, safeAuthReturn, isGoogleMember } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const url=new URL(request.url); const code=url.searchParams.get("code");
  const origin=authOrigin(siteUrl,(await headers()).get("host"),!process.env.VERCEL);
  const responseHeaders={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer"};
  const failure=(reason:string)=>NextResponse.redirect(new URL(`/auth/error?reason=${reason}`,origin),{headers:responseHeaders});
  if (url.searchParams.has("error")) {
    const reason=url.searchParams.get("error_code");
    return failure(reason==="identity_already_exists" || reason==="identity_already_linked" ? "existing" : "cancelled");
  }
  if (!code || code.length>4096) return failure("callback");
  try {
  const client=await createClient(); const {error}=await client.auth.exchangeCodeForSession(code);
  if(error) return failure("callback");
  const {data:{user}}=await client.auth.getUser(); if(!isGoogleMember(user)) return failure("callback");
  const token=(await cookies()).get(handoffCookie)?.value;
  if(token){const {error}=await client.rpc("complete_event_account_handoff",{p_token:token});if(error)return failure("handoff");(await cookies()).delete({name:handoffCookie,path:"/auth"});}
  return NextResponse.redirect(new URL(safeAuthReturn(url.searchParams.get("next")),origin),{headers:responseHeaders});
  } catch { return failure("callback"); }
}
