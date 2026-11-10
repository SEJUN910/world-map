"use client";
import { useTranslations } from "@/components/language-provider";

import { useEffect, useId, useRef, useState } from "react";
import type { AddressResult } from "@/lib/geocoding";
import { countries, type CountryCode } from "@/lib/countries";

export function AddressSearch({ value, onChange, onSelect, country = "kr" }: {
  country?: CountryCode;
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
}) {
  const { t } = useTranslations();
  const id = useId();
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);

  const search = async () => {
    if (loading) return;
    if (value.trim().length < 3) { setMessage(t("주소를 3자 이상 입력해주세요.")); return; }
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setMessage("");
    setResults([]);
    try {
      const response = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value, country }), signal: controller.signal });
      const data = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error(t(data.error || "주소를 검색하지 못했어요."));
      setResults(data.results);
      setMessage(data.results.length ? t("행사가 열리는 주소를 선택해주세요.") : t("일치하는 주소가 없어요. 도로명·건물 번호를 넣거나 위치를 직접 지정해주세요."));
    } catch (error) {
      if (current === generation.current && !controller.signal.aborted) setMessage(error instanceof Error ? error.message : t("주소를 검색하지 못했어요."));
    } finally { if (current === generation.current) setLoading(false); }
  };

  return <div className="address-search">
    <div className="address-search__heading"><label htmlFor={`${id}-address`}>{t("행사 주소")}</label><span>{t(countries[country].name)}</span></div>
    <div className="address-search__field">
      <input id={`${id}-address`} value={value} maxLength={200} placeholder={t("도로명 주소나 행사 장소의 주소를 입력해주세요")}
        aria-describedby={message ? `${id}-status` : undefined} onChange={(event) => {
          generation.current++;
          request.current?.abort();
          setLoading(false);
          setResults([]);
          setMessage("");
          onChange(event.target.value);
        }} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void search(); } }} />
      <button type="button" className={`address-search__submit${loading ? " is-loading" : ""}`} aria-label={loading ? t("주소 검색 중") : t("주소 검색")} title={t("주소 검색")} disabled={loading || value.trim().length < 3} onClick={() => void search()}>
        {loading ? <span className="address-search__spinner" aria-hidden="true" /> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
      </button>
    </div>
    {message && <p className="fine-print" id={`${id}-status`} role="status">{t(message)}</p>}
    {results.length > 0 && <ul className="address-search__results" aria-label={t("주소 검색 결과")}>{results.map((result) => <li key={result.id}>
      <button type="button" onClick={() => { onSelect(result); setResults([]); setMessage(result.approximate ? t("대략적인 위치예요. 지도를 확인해주세요.") : ""); }}>
        <strong>{result.venue || result.address}</strong>
        {result.venue && <span>{result.address}</span>}
        {result.approximate && <small>{t("대략적인 위치 · 지도 확인 권장")}</small>}
      </button>
    </li>)}</ul>}
    <p className="address-search__attribution">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p>
  </div>;
}
