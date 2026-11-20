"use client";
import { useTranslations } from "@/components/language-provider";

import { countries, isCountryCode, type CountryCode } from "@/lib/countries";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EventMap, type EventMapPoint } from "./event-map";

export function Globe({ points }: { points: EventMapPoint[] }) {
  const { t } = useTranslations();
  const router = useRouter();
  const focusCountry = useRef<((country: CountryCode) => void) | null>(null);
  const destination = useRef("/korea");
  const started = useRef(false);
  const [navigating, setNavigating] = useState<CountryCode | null>(null);

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
        className="home-country-select"
        aria-label={t("나라 선택")}
        value={navigating || ""}
        disabled={!!navigating}
        onChange={(event) => { if (isCountryCode(event.target.value)) go(event.target.value); }}
      >
        <option value="" disabled>{t("나라 선택")}</option>
        <option value="kr">{t("대한민국")}</option>
        <option value="tw">{t("대만")}</option>
      </select>
      <p className="visually-hidden" role="status">{navigating ? t("{country} 지도로 이동 중…", { country: t(countries[navigating].name) }) : ""}</p>
      <div className="home-globe">
        <EventMap
          points={points}
          overview
          onReady={(focus) => { focusCountry.current = focus; }}
          onCountryFocused={() => router.push(destination.current)}
          onCountryClick={go}
        />
      </div>
    </>
  );
}
