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
  const [navigating, setNavigating] = useState(false);

  return (
    <>
      <select
        className="home-country-select"
        aria-label={t("나라 선택")}
        defaultValue=""
        disabled={navigating}
        onChange={(event) => {
          const code = event.target.value;
          if (!isCountryCode(code)) return;
          destination.current = countries[code].path;
          router.prefetch(destination.current);
          if (!focusCountry.current) return router.push(destination.current);
          setNavigating(true);
          focusCountry.current(code);
        }}
      >
        <option value="" disabled>{t("나라 선택")}</option>
        <option value="kr">{t("대한민국")}</option>
        <option value="tw">{t("대만")}</option>
      </select>
      <div className="home-globe">
        <EventMap
          points={points}
          overview
          onReady={(focus) => { focusCountry.current = focus; }}
          onCountryFocused={() => router.push(destination.current)}
        />
      </div>
    </>
  );
}
