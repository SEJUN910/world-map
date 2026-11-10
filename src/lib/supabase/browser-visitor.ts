"use client";
import { createClient } from "./client";

export async function ensureVisitorSession() {
  const ensure = async () => {
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) return;
    const { error } = await client.auth.signInAnonymously();
    if (error)
      throw new Error(
        "저장 연결을 준비하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
  };
  // Keep first writes in separate tabs on one visitor identity. Browser-side
  // Auth requests preserve Supabase's per-visitor IP rate limit.
  if (navigator.locks) await navigator.locks.request("festiva-visitor", ensure);
  else await ensure();
}
