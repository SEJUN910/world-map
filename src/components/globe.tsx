"use client";
import { useTranslations } from "@/components/language-provider";

import { COUNTRY_CODES, countries, isCountryCode, type CountryCode } from "@/lib/countries";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EventMap, type EventMapPoint } from "./event-map";
import { CountryRequestDialog } from "./country-request-dialog";
import { EventCreateButton } from "./event-create-button";

// Value of the last option in the country select; it opens the request dialog instead of navigating.
const REQUEST_OPTION = "__request__";

export function Globe({ points }: { points: EventMapPoint[] }) {
  const { t } = useTranslations();
  const router = useRouter();
  const focusCountry = useRef<((country: CountryCode) => void) | null>(null);
  const destination = useRef("/korea");
  const started = useRef(false);
  const [navigating, setNavigating] = useState<CountryCode | null>(null);
  // Which control opened the request dialog, so focus returns there.
  const [requesting, setRequesting] = useState<"" | "select" | "dock">("");
  const select = useRef<HTMLSelectElement>(null);
  const requestButton = useRef<HTMLButtonElement>(null);
  const [mapReady, setMapReady] = useState(false);
  // Events per country for the phone shortcuts ("대한민국 806").
  const counts = new Map<CountryCode, number>();
  for (const point of points) { const code = point.countryCode || "kr"; counts.set(code, (counts.get(code) || 0) + 1); }

  // The select and a click on the globe share one handoff, so only the first choice wins.
  function go(code: CountryCode) {
    if (started.current) return;
    destination.current = countries[code].path;
    router.prefetch(destination.current);
    if (!focusCountry.current) return router.push(destination.current);
    started.current = true;
    setNavigating(code);
    focusCountry.current(code);
  }

  return (
    <>
      <select
        ref={select}
        className="home-country-select"
        aria-label={t("나라 선택")}
        value={navigating || ""}
        disabled={!!navigating}
        onChange={(event) => {
          if (event.target.value === REQUEST_OPTION) setRequesting("select");
          else if (isCountryCode(event.target.value)) go(event.target.value);
        }}
      >
        <option value="" disabled>{t("나라 선택")}</option>
        {COUNTRY_CODES.map((code) => <option key={code} value={code}>{t(countries[code].name)}</option>)}
        <option value={REQUEST_OPTION}>{t("+ 다른 나라 요청하기…")}</option>
      </select>
      {requesting && <CountryRequestDialog opener={requesting === "dock" ? requestButton : select} onDismiss={() => setRequesting("")} />}
      <p className="visually-hidden" role="status">{navigating ? t("{country} 지도로 이동 중…", { country: t(countries[navigating].name) }) : ""}</p>
      <div className="home-globe">
        {/* Shown until the globe draws (seconds on a first visit), instead of a blank page. */}
        {!mapReady && <div className="home-globe__placeholder" aria-hidden="true"><span /><p>{t("지도 불러오는 중…")}</p></div>}
        <EventMap
          points={points}
          overview
          onReady={(focus) => { focusCountry.current = focus; setMapReady(true); }}
          onCountryFocused={() => router.push(destination.current)}
          onCountryClick={go}
        />
      </div>
      {/* Phones: what this is, one tap to a country, and a labelled add button. */}
      <section className="home-dock" aria-label={t("나라 선택")}>
        <h2>{t("지도로 만나는 우리 동네 행사")}</h2>
        <p>{t("작은 동네 행사부터 지역 축제까지")}</p>
        <div className="home-dock__countries">
          {COUNTRY_CODES.map((code) => <button key={code} type="button" disabled={!!navigating} onClick={() => go(code)}>
            <strong>{t(countries[code].name)}</strong>{!!counts.get(code) && <small>{counts.get(code)}</small>}
          </button>)}
          <button ref={requestButton} type="button" className="home-dock__request" onClick={() => setRequesting("dock")}>{t("다른 나라 요청")}</button>
        </div>
        <EventCreateButton className="button home-dock__add">{t("＋ 행사 올리기")}</EventCreateButton>
      </section>
    </>
  );
}
