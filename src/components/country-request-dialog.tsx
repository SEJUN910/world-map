"use client";
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslations } from "./language-provider";
import { countryName, searchRequestableCountries } from "@/lib/requestable-countries";

type State = "idle" | "sending" | "created" | "duplicate" | "rate" | "error";

// Lets a visitor ask for a country we do not cover yet. No login; one vote per
// visitor and country is enforced by the API.
export function CountryRequestDialog({ opener, onDismiss }: { opener: RefObject<HTMLElement | null>; onDismiss: () => void }) {
  const { t, locale } = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [state, setState] = useState<State>("idle");
  const [sentName, setSentName] = useState("");
  const results = useMemo(() => searchRequestableCountries(query, locale), [query, locale]);

  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    search.current?.focus();
    return () => {
      if (element.open) element.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, [opener]);

  async function submit() {
    if (!selected || state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/country-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode: selected }) });
      const body = await response.json().catch(() => ({}));
      setSentName(countryName(selected, locale));
      setState(response.status === 429 ? "rate" : !response.ok ? "error" : body.status === "duplicate" ? "duplicate" : "created");
      if (response.ok) setSelected("");
    } catch { setState("error"); }
  }

  const message = state === "created" ? t("{country} 추가 요청을 받았어요. 요청이 많은 나라부터 행사를 채울게요.", { country: sentName })
    : state === "duplicate" ? t("이미 요청하신 나라예요: {country}", { country: sentName })
    : state === "rate" ? t("요청이 너무 많아요. 잠시 후 다시 시도해주세요.")
    : state === "error" ? t("요청을 보내지 못했어요. 잠시 후 다시 시도해주세요.") : "";

  return <dialog ref={dialog} className="country-request" aria-labelledby="country-request-title"
    onCancel={(event) => { event.preventDefault(); onDismiss(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
    <form className="country-request__panel" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <h2 id="country-request-title">{t("다른 나라 요청하기")}</h2>
      <p className="country-request__lead">{t("보고 싶은 나라를 골라 주세요. 요청이 많은 나라부터 행사를 추가할게요.")}</p>
      <input ref={search} type="search" className="country-request__search" value={query} maxLength={60}
        aria-label={t("나라 검색")} placeholder={t("나라 이름 검색 (예: 일본, Japan, JP)")}
        onChange={(event) => setQuery(event.target.value)} />
      <div className="country-request__list" role="radiogroup" aria-label={t("요청할 나라")}>
        {results.length ? results.map(({ code, name }) => <label key={code} className={selected === code ? "is-selected" : undefined}>
          <input type="radio" name="country" value={code} checked={selected === code} onChange={() => { setSelected(code); setState("idle"); }} />
          <span>{name}</span><small>{code}</small>
        </label>) : <p className="country-request__empty">{t("찾는 나라가 없어요.")}</p>}
      </div>
      <p className="country-request__status" role="status" aria-live="polite">{message}</p>
      <div className="country-request__actions">
        <button type="button" onClick={onDismiss}>{t("닫기")}</button>
        <button type="submit" disabled={!selected || state === "sending"}>{state === "sending" ? t("보내는 중…") : t("요청하기")}</button>
      </div>
    </form>
  </dialog>;
}
