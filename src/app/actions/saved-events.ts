"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isEventId } from "@/lib/events";
import { SAVED_EVENTS_LIMIT } from "@/lib/saved-events";

export async function setSavedEventAction(id: string, save: boolean): Promise<{ error?: string }> {
  if (!isEventId(id) || typeof save !== "boolean") return { error: "잘못된 요청입니다." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  // Saving is for Google members only; RLS enforces the same rule.
  if (!user || user.is_anonymous) return { error: "Google로 로그인하면 관심 행사를 저장할 수 있어요." };
  if (save) {
    const { error } = await client
      .from("saved_events")
      .upsert({ visitor_id: user.id, event_id: id }, { onConflict: "visitor_id,event_id", ignoreDuplicates: true });
    if (error)
      return {
        error: error.message.includes("saved_events_limit")
          ? "관심 행사는 200개까지 저장할 수 있어요. 지난 행사를 정리해주세요."
          : "관심 행사로 저장하지 못했어요. 공개 중인 행사인지 확인해주세요.",
      };
  } else {
    const { error } = await client.from("saved_events").delete().eq("visitor_id", user.id).eq("event_id", id);
    if (error) return { error: "관심 행사에서 빼지 못했어요. 다시 시도해주세요." };
  }
  revalidatePath("/me/saved");
  return {};
}

export async function removeSavedEventsAction(ids: string[]): Promise<{ error?: string }> {
  if (!Array.isArray(ids) || !ids.length || ids.length > SAVED_EVENTS_LIMIT || !ids.every(isEventId)) return { error: "잘못된 요청입니다." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || user.is_anonymous) return {};
  const { error } = await client.from("saved_events").delete().eq("visitor_id", user.id).in("event_id", ids);
  if (error) return { error: "목록을 정리하지 못했어요. 다시 시도해주세요." };
  revalidatePath("/me/saved");
  return {};
}
