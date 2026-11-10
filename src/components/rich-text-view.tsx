import { Fragment, type ReactNode } from "react";
import { normalizeRichText, type RichNode } from "@/lib/rich-text";

function renderNode(node: RichNode, key: number): ReactNode {
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const mark of node.marks || []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      if (mark.type === "italic") text = <em>{text}</em>;
      if (mark.type === "underline") text = <u>{text}</u>;
      if (mark.type === "link") text = <a href={mark.attrs!.href} target="_blank" rel="noopener noreferrer nofollow">{text}</a>;
    }
    return <Fragment key={key}>{text}</Fragment>;
  }
  const children = node.content?.map(renderNode);
  switch (node.type) {
    case "paragraph": return <p key={key}>{children?.length ? children : <br />}</p>;
    case "heading": return node.attrs?.level === 2 ? <h3 key={key}>{children}</h3> : <h4 key={key}>{children}</h4>;
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key} start={node.attrs?.start}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "horizontalRule": return <hr key={key} />;
    case "hardBreak": return <br key={key} />;
    default: return null;
  }
}

export function RichTextView({ content, text }: { content?: unknown; text: string }) {
  const doc = normalizeRichText(content);
  return <div className="rich-text-view">{doc ? doc.content.map(renderNode) : <p className="rich-text-plain">{text || "아직 소개가 없어요."}</p>}</div>;
}
