import { z } from "zod";
import { DESCRIPTION_LIMIT, normalizeRichText, richTextPlain } from "./rich-text";
import { pointInCountry } from "./countries";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "올바른 날짜를 입력해주세요.");
export const eventInputSchema = z
  .object({
    id: z.uuid(),
    countryCode: z.enum(["kr", "tw"]).default("kr"),
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1, "행사 소개를 입력해주세요.").max(DESCRIPTION_LIMIT),
    descriptionContent: z.unknown().optional().transform((value, ctx) => {
      if (value == null) return null;
      const doc = normalizeRichText(value);
      if (!doc) { ctx.addIssue({ code: "custom", message: "소개 글 서식을 확인해주세요." }); return z.NEVER; }
      return doc;
    }),
    region: z.string().trim().max(60),
    venue: z.string().trim().max(120),
    address: z.string().trim().max(200),
    latitude: z.number().finite(),
    longitude: z.number().finite(),
    startDate: date.nullable(),
    endDate: date.nullable(),
    officialUrl: z.union([
      z.literal(""),
      z
        .url()
        .max(1000)
        .refine((value) => /^https?:\/\//i.test(value)),
    ]),
    publicationStatus: z.enum(["draft", "published"]),
  })
  .superRefine((value, ctx) => {
    if (!pointInCountry(value.countryCode, value)) ctx.addIssue({ code: "custom", path: ["latitude"], message: "선택한 국가의 위치를 지정해주세요." });
    if (value.descriptionContent && richTextPlain(value.descriptionContent).trim() !== value.description) {
      ctx.addIssue({ code: "custom", path: ["descriptionContent"], message: "소개 글과 서식이 일치하지 않아요." });
    }
  })
  .refine(
    (value) =>
      !value.endDate || (!!value.startDate && value.endDate >= value.startDate),
    {
      message: "종료일은 시작일보다 빠를 수 없어요.",
      path: ["endDate"],
    },
  );
export function makeSlug(value: string) {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "event"
  );
}
