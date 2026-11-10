"use client";
import { useTranslations } from "@/components/language-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ensureVisitorSession } from "@/lib/supabase/browser-visitor";
import {
  changePublicationAction,
  reportEventAction,
} from "@/app/actions/events";
export function EventControls({ id, status }: { id: string; status: string }) {
  const { t } = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function change(next: "published" | "draft" | "deleted") {
    setBusy(true);
    setError("");
    try {
      const result = await changePublicationAction(id, next);
      if (result.error) setError(t(result.error));
      else {
        if (next === "deleted") router.push("/me/events");
        router.refresh();
      }
    } catch {
      setError(t("변경하지 못했어요. 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="form-actions">
        {["draft", "published"].includes(status) && (
          <>
            <Link
              className="button button-secondary"
              href={`/events/${id}/edit`}
            >
              {t("내용 수정")}</Link>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void change(status === "published" ? "draft" : "published")
              }
            >
              {busy
                ? t("처리 중…")
                : status === "published"
                  ? t("비공개로 전환")
                  : t("공개 등록")}
            </button>
          </>
        )}
      </div>
      {status === "hidden" && (
        <p className="inline-notice">{t("관리자에 의해 숨김 처리된 행사입니다.")}</p>
      )}
      {["draft", "published"].includes(status) &&
        (confirm ? (
          <div className="delete-confirm">
            <p>{t("행사를 삭제할까요? 공개 목록에서도 사라집니다.")}</p>
            <button
              className="text-link danger"
              disabled={busy}
              onClick={() => void change("deleted")}
            >
              {t("삭제하기")}</button>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              {t("취소")}</button>
          </div>
        ) : (
          <button className="text-link danger" onClick={() => setConfirm(true)}>
            {t("행사 삭제")}</button>
        ))}
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
export function ReportEvent({ id }: { id: string }) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="report-event">
      <button className="text-link" onClick={() => setOpen(!open)}>
        {t("행사 정보 신고")}</button>
      {open && (
        <form
          className="form-fields"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            try {
              await ensureVisitorSession();
              const result = await reportEventAction(
                id,
                String(form.get("reason")),
              );
              setMessage(
                result.error || t("신고를 접수했어요. 확인 후 처리하겠습니다."),
              );
            } catch {
              setMessage(t("신고를 접수하지 못했어요."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("신고 사유")}<textarea
              name="reason"
              required
              minLength={5}
              maxLength={1000}
              rows={3}
            />
          </label>
          <button className="button button-secondary" disabled={busy}>
            {t("신고 접수")}</button>
        </form>
      )}
      {message && (
        <p className="inline-notice" role="status">
          {t(message)}
        </p>
      )}
    </div>
  );
}
