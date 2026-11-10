"use client";
import { useTranslations } from "@/components/language-provider";
import { useAccount } from "./account-provider";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { countries, isCountryCode, pointInCountry, type CountryCode } from "@/lib/countries";
import { EventMap } from "./event-map";
import dynamic from "next/dynamic";
import { DESCRIPTION_LIMIT, normalizeRichText, type RichDocument } from "@/lib/rich-text";
const RichTextEditor = dynamic(() => import("./rich-text-editor").then((module) => module.RichTextEditor), { ssr: false });
import { AddressSearch } from "./address-search";
import { saveEventAction } from "@/app/actions/events";
import { ensureVisitorSession } from "@/lib/supabase/browser-visitor";
import type { CloudEvent } from "@/lib/event-repository";
import { eventPath } from "@/lib/events";
import { preparePoster, readDrafts, type EventDraft } from "@/lib/drafts";
type Fields = {
  title: string;
  venue: string;
  address: string;
  region: string;
  description: string;
  startDate: string;
  endDate: string;
  dateUnknown: boolean;
  officialUrl: string;
};
const empty: Fields = {
  title: "",
  venue: "",
  address: "",
  region: "",
  description: "",
  startDate: "",
  endDate: "",
  dateUnknown: false,
  officialUrl: "",
};

function RegistrationSteps({ step, onChange }: { step: number; onChange: (step: number) => void }) {
  const { t } = useTranslations();
  return <nav className="registration-steps" aria-label={t("행사 등록 단계")}>
    {[t("위치 선택"), t("포스터·내용")].map((label, index) => <button key={label} type="button" aria-current={step === index ? "step" : undefined}
      className={step === index ? "is-active" : ""} onClick={() => onChange(index)}><span>{index + 1}</span>{label}</button>)}
  </nav>;
}
export function EventForm({
  draftId,
  existing,
  modal = false,
  onSaved,
  onSavingChange,
}: {
  draftId?: string;
  existing?: CloudEvent;
  modal?: boolean;
  onSaved?: (result: { id: string; slug: string; countryCode: CountryCode; publicationStatus: "draft" | "published" }) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const { t } = useTranslations();
  const router = useRouter();
  const { account } = useAccount();
  const pathname = usePathname();
  const [country, setCountry] = useState<CountryCode>(existing?.countryCode || (pathname === "/taiwan" ? "tw" : "kr"));
  const [fields, setFields] = useState<Fields>(empty);
  const [poster, setPoster] = useState("");
  const [descriptionContent, setDescriptionContent] = useState<RichDocument | null>(null);
  const [point, setPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(!draftId);
  const [saved, setSaved] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [step, setStep] = useState(existing ? 1 : 0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const imageRequest = useRef(0);
  const submissionId = useRef<string | null>(existing?.id || null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!draftId && !existing) return;
    try {
      const draft =
        existing || readDrafts().find((item) => item.id === draftId);
      if (!draft) {
        setError(t("수정할 초안을 찾을 수 없어요."));
        return;
      }
      setFields({
        title: draft.title,
        venue: draft.venue,
        address: draft.address,
        region: draft.region,
        description: draft.description,
        startDate: draft.startDate || "",
        endDate: draft.endDate || "",
        dateUnknown: !draft.startDate,
        officialUrl: draft.officialUrl,
      });
      setDescriptionContent(normalizeRichText(draft.descriptionContent));
      setCountry(draft.countryCode || "kr");
      setPoster(draft.poster);
      setPoint({ latitude: draft.latitude, longitude: draft.longitude });
      setReady(true);
    } catch {
      setError(t("이 브라우저의 초안을 불러오지 못했어요."));
    }
  }, [draftId, existing?.id]);
  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    if (key === "address") setPoint(null);
  }
  function changeStep(value: number) {
    setError("");
    setStep(value);
    requestAnimationFrame(() => {
      stepHeading.current?.focus({ preventScroll: true });
      stepHeading.current?.closest("dialog")?.scrollTo({ top: 0 });
    });
  }
  function nextStep() {
    if (!pointInCountry(country, point)) {
      setError(t("주소를 검색해 위치를 선택해주세요. 지도에서 직접 지정할 수도 있어요."));
      return;
    }
    changeStep(1);
  }
  async function upload(file?: File) {
    if (!file || saving) return;
    const request = ++imageRequest.current;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const image = await preparePoster(file);
      if (request === imageRequest.current) setPoster(image);
    } catch (error) {
      if (request === imageRequest.current)
        setError(
          error instanceof Error
            ? error.message
            : t("이미지를 읽지 못했어요. 다른 이미지를 선택해주세요."),
        );
    } finally {
      if (request === imageRequest.current) setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0) { nextStep(); return; }
    setError("");
    if (!poster || busy) {
      setError(t("포스터 업로드를 완료해주세요."));
      return;
    }
    if (!fields.title.trim() || !fields.description.trim()) {
      setError(t("행사명과 소개를 입력해주세요."));
      return;
    }
    if (fields.description.length > DESCRIPTION_LIMIT || (descriptionContent && !normalizeRichText(descriptionContent))) {
      setError(t("소개는 20,000자 이내로 작성해주세요. 서식이 너무 복잡하면 줄여주세요."));
      return;
    }
    if (!point || !pointInCountry(country, point)) {
      setError(t("선택한 국가의 주소를 검색하거나 지도에서 위치를 지정해주세요."));
      return;
    }
    if (!fields.dateUnknown && !fields.startDate) {
      setError(t("행사 날짜를 입력하거나 일정 미정을 선택해주세요."));
      return;
    }
    if (
      !fields.dateUnknown &&
      fields.endDate &&
      fields.endDate < fields.startDate
    ) {
      setError(t("종료일은 시작일보다 빠를 수 없어요."));
      return;
    }
    if (fields.officialUrl) {
      try {
        const url = new URL(fields.officialUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw Error();
      } catch {
        setError(t("공식 링크는 https:// 또는 http:// 주소로 입력해주세요."));
        return;
      }
    }
    const intent = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const publicationStatus = intent?.value === "draft" ? "draft" : "published";
    submissionId.current ||= crypto.randomUUID();
    const draft: EventDraft = {
      countryCode: country,
      id: submissionId.current,
      slug: "draft",
      title: fields.title.trim(),
      description: fields.description.trim(),
      descriptionContent,
      venue: fields.venue.trim(),
      address: fields.address.trim(),
      region: fields.region.trim(),
      regionCode: "",
      ...point,
      poster,
      startDate: fields.dateUnknown ? null : fields.startDate,
      endDate: fields.dateUnknown ? null : fields.endDate || null,
      officialUrl: fields.officialUrl.trim(),
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    onSavingChange?.(true);
    try {
      await ensureVisitorSession();
      const form = new FormData();
      for (const key of [
        "id",
        "countryCode",
        "title",
        "description",
        "venue",
        "address",
        "region",
        "latitude",
        "longitude",
        "startDate",
        "endDate",
        "officialUrl",
      ] as const)
        form.set(key, String(draft[key] ?? ""));
      form.set("publicationStatus", publicationStatus);
      if (descriptionContent) form.set("descriptionContent", JSON.stringify(descriptionContent));
      if (poster.startsWith("data:image/jpeg;base64,")) {
        const blob = await (await fetch(poster)).blob();
        form.set(
          "poster",
          new File([blob], "poster.jpg", { type: "image/jpeg" }),
        );
      }
      const result = await saveEventAction(form);
      if (result.error || !result.id || !result.slug) {
        setError(t(result.error || "저장하지 못했어요."));
        return;
      }
      setSaved(true);
      if (onSaved) {
        onSaved({ id: result.id, slug: result.slug, countryCode: country, publicationStatus });
        return;
      }
      router.push(
        publicationStatus === "published"
          ? eventPath({ id: result.id, countryCode: country })
          : `/me/events/${result.id}`,
      );
      router.refresh();
    } catch {
      setError(
        t("저장하지 못했어요. 입력한 내용은 유지됩니다. 다시 시도해주세요."),
      );
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }
  return (
    <div className={`registration shell${modal ? " registration--modal" : ""}`}>
      {!modal && <div className="registration-heading">
        <Link className="text-link" href={countries[country].path}>
          {t("← 돌아가기")}</Link>
        <p className="eyebrow">SHARE YOUR LOCAL DISCOVERY</p>
        <h1>
          {t("작은 행사도,")}<br />
          {t("누군가에겐 큰 발견.")}</h1>
        <p>{t("포스터 한 장으로 우리 동네 소식을 나눠주세요.")}</p>
      </div>}
      <div className="registration-body">
        <div className="sample-banner">
          {account && !account.anonymous ? t("계정에 저장한 행사는 다른 기기에서도 관리할 수 있어요.") : t("가입 없이 올릴 수 있어요. Google로 로그인하면 이 브라우저에서 올린 행사도 계정에 연결됩니다. 로그인 전에는 브라우저 데이터를 지우면 수정 권한을 잃을 수 있어요.")}</div>
        <form onSubmit={save}>
          <fieldset className="form-reset" disabled={saving}>
            <RegistrationSteps step={step} onChange={(next) => next === 0 ? changeStep(0) : nextStep()} />
            <h2 className="registration-step-title" ref={stepHeading} tabIndex={-1}>{step === 0 ? t("어디서 열리나요?") : t("어떤 행사인가요?")}</h2>
            {step === 0 ? <section aria-label={t("행사 위치")} className="registration-location-step">
                <label className="registration-country">{t("국가")}<select value={country} onChange={(event) => {
                    if (!isCountryCode(event.target.value)) return;
                    setCountry(event.target.value); setPoint(null); setFields((previous) => ({ ...previous, address: "", region: "", venue: "" })); setError(""); setSaved(false);
                  }}>{Object.entries(countries).map(([code, value]) => <option key={code} value={code}>{t(value.name)}</option>)}</select>
                </label>
                <div className="event-location">
                <AddressSearch
                  key={country} country={country}
                  value={fields.address}
                  onChange={(value) => update("address", value)}
                  onSelect={(result) => {
                    setFields((previous) => ({ ...previous, address: result.address, region: result.region || previous.region, venue: previous.venue || result.venue }));
                    setPoint({ latitude: result.latitude, longitude: result.longitude });
                    setError("");
                    setSaved(false);
                    if (result.approximate) setMapOpen(true);
                  }}
                />
                <details className="location-adjust" open={mapOpen} onToggle={(event) => setMapOpen(event.currentTarget.open)}>
                  <summary>{point ? t("지도로 위치 확인·수정") : t("위치 직접 지정하기")}</summary>
                  {mapOpen && <EventMap country={country} point={point} onPick={(value) => { setPoint(value); setError(""); setSaved(false); }} />}
                  <details>
                    <summary>{t("좌표로 직접 지정하기")}</summary>
                    <div className="field-row">
                      <label>{t("위도")}<input type="number" step="any" min={countries[country].bounds[1]} max={countries[country].bounds[3]} value={point?.latitude ?? ""}
                        onChange={(event) => { setPoint(event.target.value ? { latitude: Number(event.target.value), longitude: point?.longitude ?? countries[country].center[0] } : null); setSaved(false); }} /></label>
                      <label>{t("경도")}<input type="number" step="any" min={countries[country].bounds[0]} max={countries[country].bounds[2]} value={point?.longitude ?? ""}
                        onChange={(event) => { setPoint(event.target.value ? { longitude: Number(event.target.value), latitude: point?.latitude ?? countries[country].center[1] } : null); setSaved(false); }} /></label>
                    </div>
                  </details>
                </details>
                </div>
                <div className="field-row">
                  <label>
                    {t("지역")}<span className="optional">{t("선택")}</span>
                    <input
                      value={fields.region}
                      onChange={(event) => update("region", event.target.value)}
                      placeholder={t("예: 서울 성동구")}
                      maxLength={60}
                    />
                  </label>
                  <label>
                    {t("장소명")}<span className="optional">{t("선택")}</span>
                    <input
                      value={fields.venue}
                      onChange={(event) => update("venue", event.target.value)}
                      placeholder={t("예: 성수동 ○○공방")}
                      maxLength={120}
                    />
                  </label>
                </div>
              <div className="form-actions"><button type="button" className="button" disabled={!ready} onClick={nextStep}>{t("다음 →")}</button></div>
            </section> : <>
            <section aria-label={t("포스터 업로드")}>
              <label
                className={`upload-zone ${poster ? "has-poster" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void upload(event.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={t("행사 포스터 선택")}
                  disabled={busy || !ready}
                  onChange={(event) => {
                    void upload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                {poster ? (
                  <img src={poster} alt={t("선택한 포스터 미리보기")} />
                ) : (
                  <span>
                    <strong aria-hidden="true">＋</strong>
                    <b>{t("행사 포스터를 올려주세요")}</b>
                    <small>{t("파일을 선택하거나 이곳에 끌어다 놓으세요")}</small>
                    <small>{t("JPG, PNG, WebP · 최대 10MB · 1장")}</small>
                  </span>
                )}
              </label>
              <p className="fine-print" role="status">
                {busy
                  ? t("포스터를 준비하고 있어요…")
                  : poster
                    ? t("포스터를 바꾸려면 이미지를 다시 눌러주세요.")
                    : t("직접 만들었거나 사용 허락을 받은 포스터를 올려주세요.")}
              </p>
            </section>
            <section aria-label={t("행사 정보")}>
              <div className="form-fields">
                <label>
                  {t("행사명")}<span className="required">{t("필수")}</span>
                  <input
                    value={fields.title}
                    onChange={(event) => update("title", event.target.value)}
                    maxLength={100}
                    required
                    placeholder={t("예: 성수 골목 주말마켓")}
                  />
                </label>
                <fieldset>
                  <legend>
                    {t("언제 열리나요?")}<span className="required">{t("필수")}</span>
                  </legend>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={fields.dateUnknown}
                      onChange={(event) =>
                        update("dateUnknown", event.target.checked)
                      }
                    />
                    {t("아직 일정이 정해지지 않았어요")}</label>
                  <div className="field-row">
                    <label>
                      {t("시작일")}<input
                        type="date"
                        value={fields.startDate}
                        disabled={fields.dateUnknown}
                        required={!fields.dateUnknown}
                        onChange={(event) =>
                          update("startDate", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      {t("종료일")}<span className="optional">{t("선택")}</span>
                      <input
                        type="date"
                        value={fields.endDate}
                        min={fields.startDate || undefined}
                        disabled={fields.dateUnknown}
                        onChange={(event) =>
                          update("endDate", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <div className="extra-fields">
                  <RichTextEditor content={descriptionContent} text={fields.description} disabled={saving}
                    onChange={(content, text) => { setDescriptionContent(content); update("description", text); }} />
                  <label>
                    {t("공식 링크")}<span className="optional">{t("선택")}</span>
                    <input
                      type="url"
                      value={fields.officialUrl}
                      onChange={(event) =>
                        update("officialUrl", event.target.value)
                      }
                      placeholder="https://"
                      maxLength={1000}
                    />
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="text-link registration-back" onClick={() => changeStep(0)}>{t("← 위치 수정")}</button>
                <button
                  className="button button-secondary"
                  type="submit"
                  name="intent"
                  value="draft"
                  disabled={!ready || busy || saving}
                >
                  {t("비공개로 저장")}</button>
                <button
                  className="button"
                  type="submit"
                  name="intent"
                  value="published"
                  disabled={!ready || busy}
                >
                  {saving
                    ? t("저장 중…")
                    : saved
                      ? t("저장했어요")
                      : existing?.publicationStatus === "published"
                        ? t("수정하고 공개하기 →")
                        : t("행사 공개 등록 →")}
                </button>
              </div>
            </section>
            </>}
            {error && (
              <p className="form-error" role="alert">
                {t(error)}
              </p>
            )}
          </fieldset>
        </form>
        <Link className="registration-my-events" href="/me/events" prefetch={false}>{t("내 행사")}</Link>
      </div>
    </div>
  );
}
