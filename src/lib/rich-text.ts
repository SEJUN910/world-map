export const DESCRIPTION_LIMIT = 20_000;
export type RichMark = { type: "bold" | "italic" | "underline" | "link"; attrs?: { href: string } };
export type RichNode = { type: string; text?: string; attrs?: { level?: number; start?: number }; marks?: RichMark[]; content?: RichNode[] };
export type RichDocument = RichNode & { type: "doc"; content: RichNode[] };

export function safeRichLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}

// A small shared allowlist: no HTML, images, embeds, arbitrary styles or scripts.
export function normalizeRichText(value: unknown): RichDocument | null {
  let nodes = 0;
  let characters = 0;
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).length > 200_000) return null;
    const visit = (input: unknown, depth: number): RichNode => {
      if (++nodes > 4000 || depth > 12 || !input || typeof input !== "object") throw new Error();
      const raw = input as Record<string, unknown>;
      const type = raw.type;
      if (typeof type !== "string") throw new Error();
      const node: RichNode = { type };
      if (type === "text") {
        if (typeof raw.text !== "string" || !raw.text.length) throw new Error();
        characters += raw.text.length;
        if (characters > DESCRIPTION_LIMIT) throw new Error();
        node.text = raw.text;
        if (raw.marks !== undefined) {
          if (!Array.isArray(raw.marks) || raw.marks.length > 4) throw new Error();
          node.marks = raw.marks.map((input): RichMark => {
            const mark = input as { type?: unknown; attrs?: { href?: unknown } };
            if (!mark || !["bold", "italic", "underline", "link"].includes(String(mark.type))) throw new Error();
            if (mark.type === "link") {
              const href = safeRichLink(mark.attrs?.href);
              if (!href) throw new Error();
              return { type: "link", attrs: { href } };
            }
            return { type: mark.type as RichMark["type"] };
          });
          if (!node.marks.length) delete node.marks;
        }
        return node;
      }
      if (type === "hardBreak" || type === "horizontalRule") return node;
      if (!["doc", "paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem"].includes(type)) throw new Error();
      if ((depth === 0) !== (type === "doc")) throw new Error();
      const attrs = raw.attrs as { level?: unknown; start?: unknown } | undefined;
      if (type === "heading") {
        if (attrs?.level !== 2 && attrs?.level !== 3) throw new Error();
        node.attrs = { level: attrs.level };
      }
      if (type === "orderedList" && attrs?.start !== undefined) {
        if (!Number.isInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 9999) throw new Error();
        node.attrs = { start: Number(attrs.start) };
      }
      if (raw.content !== undefined && !Array.isArray(raw.content)) throw new Error();
      node.content = ((raw.content || []) as unknown[]).map((child) => visit(child, depth + 1));
      const allowed = type === "paragraph" || type === "heading" ? ["text", "hardBreak"]
        : type === "bulletList" || type === "orderedList" ? ["listItem"]
          : ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "horizontalRule"];
      if (node.content.some((child) => !allowed.includes(child.type))) throw new Error();
      if (type === "listItem" && node.content[0]?.type !== "paragraph") throw new Error();
      return node;
    };
    const doc = visit(value, 0);
    if (doc.type !== "doc" || richTextPlain(doc).length > DESCRIPTION_LIMIT) return null;
    return doc as RichDocument;
  } catch { return null; }
}

export function richTextPlain(node: RichNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  const inline = node.type === "paragraph" || node.type === "heading";
  return (node.content || []).map(richTextPlain).join(inline ? "" : "\n");
}

export function plainTextDocument(text: string): RichDocument {
  return { type: "doc", content: text.split(/\r?\n/).map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) };
}
