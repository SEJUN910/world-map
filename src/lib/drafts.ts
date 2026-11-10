import type { FestivalEvent } from "./events";
export type EventDraft = Omit<FestivalEvent, "isSample"> & {
  updatedAt: string;
};
const key = "festiva-event-drafts-v2";
export function readDrafts(): EventDraft[] {
  const raw: unknown = JSON.parse(localStorage.getItem(key) || "[]");
  if (!Array.isArray(raw)) throw new Error("저장된 초안을 읽을 수 없습니다.");
  return raw.filter(
    (value): value is EventDraft =>
      value &&
      typeof value.id === "string" &&
      typeof value.title === "string" &&
      typeof value.slug === "string" &&
      typeof value.description === "string" &&
      typeof value.region === "string" &&
      typeof value.regionCode === "string" &&
      typeof value.venue === "string" &&
      typeof value.address === "string" &&
      typeof value.officialUrl === "string" &&
      typeof value.updatedAt === "string" &&
      (value.startDate === null || typeof value.startDate === "string") &&
      (value.endDate === null || typeof value.endDate === "string") &&
      typeof value.poster === "string" &&
      /^data:image\/jpeg;base64,/.test(value.poster) &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude),
  );
}
export function saveDraft(draft: EventDraft) {
  const drafts = readDrafts();
  localStorage.setItem(
    key,
    JSON.stringify([draft, ...drafts.filter((item) => item.id !== draft.id)]),
  );
}
export function deleteDraft(id: string) {
  localStorage.setItem(
    key,
    JSON.stringify(readDrafts().filter((item) => item.id !== id)),
  );
}
export async function preparePoster(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG, PNG, WebP 이미지를 선택해주세요.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("10MB 이하 이미지를 선택해주세요.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("이미지 처리를 지원하지 않는 브라우저입니다.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.82);
    const payload = result.slice(result.indexOf(",") + 1);
    const bytes = Math.floor(payload.length * 3 / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
    if (bytes > 3 * 1024 * 1024) throw new Error("이미지를 압축해도 너무 커요. 더 작은 이미지를 선택해주세요.");
    return result;
  } finally {
    bitmap.close();
  }
}
