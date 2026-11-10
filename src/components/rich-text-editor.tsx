"use client";
import { useTranslations } from "@/components/language-provider";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { CSSProperties } from "react";
import { DESCRIPTION_LIMIT, normalizeRichText, plainTextDocument, richTextPlain, safeRichLink, type RichDocument } from "@/lib/rich-text";

export function RichTextEditor({ content, text, disabled, onChange }: {
  content: RichDocument | null;
  text: string;
  disabled: boolean;
  onChange: (content: RichDocument, text: string) => void;
}) {
  const { t } = useTranslations();
  const id = useId();
  const [message, setMessage] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const callback = useRef(onChange);
  const emitted = useRef(new WeakSet<RichDocument>());
  callback.current = onChange;
  const extensions = useMemo(() => [StarterKit.configure({
    heading: { levels: [2, 3] }, code: false, codeBlock: false, strike: false,
    link: { openOnClick: false, defaultProtocol: "https", isAllowedUri: (url) => !!safeRichLink(url) },
  })], []);
  const editor = useEditor({
    extensions, immediatelyRender: false, shouldRerenderOnTransaction: false,
    content: content || plainTextDocument(text),
    editable: !disabled,
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-required": "true", "aria-labelledby": `${id}-label`, class: "rich-text-view" } },
    onUpdate: ({ editor }) => {
      const raw = editor.getJSON() as RichDocument;
      const normalized = normalizeRichText(raw);
      const doc = normalized || raw;
      setMessage(normalized ? "" : t("서식이 너무 복잡하거나 20,000자를 넘었어요. 내용을 줄여주세요."));
      emitted.current.add(doc);
      callback.current(doc, richTextPlain(doc).trim());
    },
  });
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? {
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"),
    heading: editor.isActive("heading"), bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"),
    quote: editor.isActive("blockquote"), link: editor.isActive("link"), empty: editor.isEmpty,
    undo: editor.can().undo(), redo: editor.can().redo(),
  } : null });

  useEffect(() => {
    if (!editor) return;
    // Parent echoes must never reset the live selection/history while typing.
    if (content && emitted.current.has(content)) return;
    const next = content || plainTextDocument(text);
    if (JSON.stringify(normalizeRichText(editor.getJSON()) || editor.getJSON()) !== JSON.stringify(next)) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, content, text]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);

  const button = (label: string, visual: string, active: boolean | undefined, action: () => void, unavailable = false) =>
    <button key={label} type="button" title={label} aria-label={label} aria-pressed={!!active} disabled={!editor || disabled || unavailable}
      onMouseDown={(event) => event.preventDefault()} onClick={action}>{visual}</button>;

  return <div className="description-field">
    <div id={`${id}-label`} className="rich-editor__label">{t("행사 소개")}<span className="required">{t("필수")}</span></div>
    <div className={`rich-editor${state?.empty ? " is-empty" : ""}${disabled ? " is-disabled" : ""}`} style={{ "--editor-placeholder": JSON.stringify(t("행사 소개와 프로그램, 참여 방법 등을 자유롭게 작성해주세요.")) } as CSSProperties}>
      <div className="rich-editor__toolbar" role="group" aria-label={t("소개 글 서식")}>
        {button(t("소제목"), "H", state?.heading, () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
        {button(t("굵게"), "B", state?.bold, () => editor?.chain().focus().toggleBold().run())}
        {button(t("기울임"), "I", state?.italic, () => editor?.chain().focus().toggleItalic().run())}
        {button(t("밑줄"), "U", state?.underline, () => editor?.chain().focus().toggleUnderline().run())}
        {button(t("글머리표"), t("• 목록"), state?.bullet, () => editor?.chain().focus().toggleBulletList().run())}
        {button(t("번호 목록"), t("1. 목록"), state?.ordered, () => editor?.chain().focus().toggleOrderedList().run())}
        {button(t("인용"), "❞", state?.quote, () => editor?.chain().focus().toggleBlockquote().run())}
        {button(t("링크"), "↗", state?.link, () => { setLink(editor?.getAttributes("link").href || ""); setLinkOpen((value) => !value); })}
        {button(t("구분선"), "—", false, () => editor?.chain().focus().setHorizontalRule().run())}
        {button(t("실행 취소"), "↶", false, () => editor?.chain().focus().undo().run(), !state?.undo)}
        {button(t("다시 실행"), "↷", false, () => editor?.chain().focus().redo().run(), !state?.redo)}
      </div>
      {linkOpen && <div className="rich-editor__link">
        <input aria-label={t("본문 링크 주소")} type="url" value={link} placeholder="https://" onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
        <button type="button" disabled={disabled} onClick={() => {
          if (!link.trim()) { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); return; }
          const href = safeRichLink(link.trim());
          if (!href) { setMessage(t("링크는 https:// 또는 http:// 주소로 입력해주세요.")); return; }
          editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
          setMessage(""); setLinkOpen(false);
        }}>{t("적용")}</button>
        <button type="button" onClick={() => setLinkOpen(false)}>{t("닫기")}</button>
      </div>}
      <EditorContent editor={editor} />
      <div className="rich-editor__footer"><span>{message && <span role="alert">{t(message)}</span>}</span><span>{text.length.toLocaleString()} / {DESCRIPTION_LIMIT.toLocaleString()}</span></div>
    </div>
  </div>;
}
