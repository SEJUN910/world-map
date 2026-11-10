"use server";
import { countries } from "@/lib/countries";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureVisitor } from "@/lib/supabase/visitor";
import { eventInputSchema, makeSlug } from "@/lib/event-validation";
import type { Json } from "@/lib/supabase/database.types";

function refreshEvents(id: string) {
  revalidatePath("/");
  revalidatePath("/korea");
  revalidatePath("/taiwan");
  revalidatePath("/me/events");
  revalidatePath(`/me/events/${id}`);
  revalidatePath("/events/[id]/[slug]", "page");
}
export async function saveEventAction(
  form: FormData,
): Promise<{ error?: string; id?: string; slug?: string }> {
  if (!(form instanceof FormData))
    return { error: "올바른 등록 요청이 아닙니다." };
  let descriptionContent: unknown = null;
  const rich = form.get("descriptionContent");
  if (rich) {
    if (typeof rich !== "string" || rich.length > 200_000) return { error: "소개 글이 너무 길거나 복잡해요." };
    try { descriptionContent = JSON.parse(rich); } catch { return { error: "소개 글 서식을 확인해주세요." }; }
  }
  const parsed = eventInputSchema.safeParse({
    id: form.get("id"),
    countryCode: form.get("countryCode") || "kr",
    title: form.get("title"),
    description: form.get("description"),
    descriptionContent,
    region: form.get("region") || "",
    venue: form.get("venue") || "",
    address: form.get("address"),
    latitude: Number(form.get("latitude")),
    longitude: Number(form.get("longitude")),
    startDate: form.get("startDate") || null,
    endDate: form.get("endDate") || null,
    officialUrl: form.get("officialUrl"),
    publicationStatus: form.get("publicationStatus"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues.some((issue) => ["description", "descriptionContent"].includes(String(issue.path[0]))) ? "소개를 입력하고 글자 수(최대 20,000자)와 서식을 확인해주세요." : "행사명·일정과 위치를 다시 확인해주세요." };
  const value = parsed.data;
  const client = await createClient();
  const user = await ensureVisitor(client);
  if (!user)
    return {
      error:
        "저장 연결을 준비하지 못했어요. 입력 내용은 유지됩니다. 다시 시도해주세요.",
    };
  const file = form.get("poster");
  const poster = file instanceof File && file.size ? file : null;
  if (poster) {
    if (poster.type !== "image/jpeg" || poster.size > 3 * 1024 * 1024)
      return { error: "전송할 포스터는 3MB 이하 JPG여야 해요. 이미지를 다시 선택해주세요." };
    const signature = new Uint8Array(await poster.slice(0, 3).arrayBuffer());
    if (signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255)
      return { error: "올바른 JPG 파일이 아니에요." };
  }
  const { data: existing, error: lookupError } = await client
    .from("events")
    .select("id, author_id, publication_status, event_images(storage_path)")
    .eq("id", value.id)
    .maybeSingle();
  if (lookupError || (existing && existing.author_id !== user.id))
    return { error: "수정할 권한이 없어요." };
  if (existing && !["draft", "published"].includes(existing.publication_status))
    return { error: "숨김 또는 삭제된 행사는 수정할 수 없어요." };
  if (!existing && !poster) return { error: "포스터를 먼저 올려주세요." };
  const row = {
    country_code: value.countryCode,
    timezone: countries[value.countryCode].timezone,
    title: value.title,
    slug: makeSlug(value.title),
    description: value.description,
    description_content: value.descriptionContent as Json | null,
    region: value.region,
    region_code: value.region ? makeSlug(value.region) : "unassigned",
    venue: value.venue,
    address: value.address,
    latitude: value.latitude,
    longitude: value.longitude,
    start_date: value.startDate,
    end_date: value.endDate,
    official_url: value.officialUrl,
  };
  if (!existing) {
    const { error } = await client.from("events").insert({
      ...row,
      id: value.id,
      author_id: user.id,
      publication_status: "draft",
    });
    if (error) return { error: "행사를 준비하지 못했어요. 다시 시도해주세요." };
  }
  const relation = existing?.event_images;
  const oldPath =
    (Array.isArray(relation)
      ? relation[0]?.storage_path
      : relation?.storage_path) || "";
  let uploadedPath = "";
  if (poster) {
    uploadedPath = `${user.id}/${value.id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await client.storage
      .from("event-posters")
      .upload(uploadedPath, poster, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError)
      return {
        error:
          "포스터를 저장하지 못했어요. 입력 내용은 유지됩니다. 다시 저장해주세요.",
      };
    const { error: imageError } = await client
      .from("event_images")
      .upsert({ event_id: value.id, storage_path: uploadedPath });
    if (imageError) {
      await client.storage.from("event-posters").remove([uploadedPath]);
      return { error: "포스터 연결에 실패했어요. 다시 저장해주세요." };
    }
  }
  const { error } = await client
    .from("events")
    .update({ ...row, publication_status: value.publicationStatus })
    .eq("id", value.id)
    .eq("author_id", user.id)
    .select("id")
    .single();
  if (error)
    return {
      error:
        "행사 정보를 저장하지 못했어요. 포스터는 초안에 보관됩니다. 다시 시도해주세요.",
    };
  if (uploadedPath && oldPath && oldPath !== uploadedPath)
    await client.storage.from("event-posters").remove([oldPath]);
  refreshEvents(value.id);
  return { id: value.id, slug: row.slug };
}
export async function changePublicationAction(
  id: string,
  status: "draft" | "published" | "deleted",
) {
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !["draft", "published", "deleted"].includes(status)
  )
    return { error: "잘못된 요청입니다." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "행사를 작성한 브라우저에서 변경해주세요." };
  const { error } = await client
    .from("events")
    .update({ publication_status: status })
    .eq("id", id)
    .eq("author_id", user.id)
    .select("id")
    .single();
  if (error)
    return { error: error.message.includes("events_user_description_required") ? "행사 소개를 짧게 입력한 뒤 공개해주세요." : "변경하지 못했어요. 포스터와 수정 권한을 확인해주세요." };
  refreshEvents(id);
  return { success: true };
}
export async function reportEventAction(id: string, reason: string) {
  if (
    typeof reason !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    reason.trim().length < 5 ||
    reason.length > 1000
  )
    return { error: "신고 사유를 5~1000자로 입력해주세요." };
  const client = await createClient();
  const user = await ensureVisitor(client);
  if (!user)
    return { error: "신고 연결을 준비하지 못했어요. 다시 시도해주세요." };
  const { error } = await client
    .from("reports")
    .insert({ event_id: id, reporter_id: user.id, reason: reason.trim() });
  return error
    ? {
        error:
          error.code === "23505"
            ? "이미 신고한 행사입니다."
            : "신고를 접수하지 못했어요.",
      }
    : { success: true };
}
