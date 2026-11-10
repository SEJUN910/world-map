import { z } from "zod";
export const analyticsInput = z.object({
  id: z.uuid(), kind: z.enum(["page_view", "event_view"]), eventId: z.uuid().nullable(),
  path: z.enum(["/", "/korea", "/taiwan", "/regions"]), country: z.enum(["kr", "tw"]).nullable(),
  locale: z.enum(["ko", "en", "zh-TW"]), referrer: z.string().max(253).regex(/^$|^[a-zA-Z0-9.-]+$/),
}).strict().refine((value) => (value.kind === "event_view") === (value.eventId !== null));
export { analyticsPath, isLocalHost } from "./analytics-path";
