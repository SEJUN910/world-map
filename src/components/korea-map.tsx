"use client";
import { useTranslations } from "@/components/language-provider";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Geometry } from "geojson";
import type { FestivalEvent } from "@/lib/events";
type Point = { latitude: number; longitude: number };
export function KoreaMap({
  region = "",
  events = [],
  onRegion,
  point,
  onPick,
  showHelp = true,
}: {
  region?: string;
  events?: FestivalEvent[];
  onRegion?: (region: string) => void;
  point?: Point | null;
  onPick?: (point: Point) => void;
  showHelp?: boolean;
}) {
  const { t } = useTranslations();
  const svg = useRef<SVGSVGElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch("/assets/korea.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then(setGeometry)
      .catch((error) => {
        if (error.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [retry]);
  const projection = useMemo(
    () =>
      geometry
        ? geoMercator().fitExtent(
            [
              [50, 24],
              [430, 525],
            ],
            geometry,
          )
        : null,
    [geometry],
  );
  const selected =
    point && projection ? projection([point.longitude, point.latitude]) : null;
  return (
    <div className={`korea-map ${onPick ? "map-pick" : ""}`}>
      <svg
        ref={svg}
        viewBox="0 0 480 550"
        role="group"
        aria-label={
          onPick
            ? t("행사 위치 선택 지도. 아래 좌표 입력으로도 지정할 수 있습니다.")
            : t("한국 지역별 행사 지도")
        }
      >
        {geometry && projection && (
          <path
            className="korea-land"
            d={geoPath(projection)(geometry) || ""}
            onClick={(event) => {
              if (!onPick || !svg.current) return;
              const matrix = svg.current.getScreenCTM();
              if (!matrix) return;
              const coordinate = new DOMPoint(
                event.clientX,
                event.clientY,
              ).matrixTransform(matrix.inverse());
              const location = projection.invert?.([
                coordinate.x,
                coordinate.y,
              ]);
              if (location)
                onPick({
                  longitude: Number(location[0].toFixed(5)),
                  latitude: Number(location[1].toFixed(5)),
                });
            }}
          />
        )}
        {projection &&
          !onPick &&
          [
            ...new Map(
              events.map((event) => [event.regionCode, event]),
            ).values(),
          ].map((event) => {
            const location = projection([event.longitude, event.latitude]);
            if (!location) return null;
            return (
              <g
                key={event.id}
                transform={`translate(${location[0]},${location[1]})`}
                className={onRegion ? "map-region-dot" : undefined}
                role={onRegion ? "button" : undefined}
                tabIndex={onRegion ? 0 : undefined}
                aria-label={onRegion ? `${event.region} 행사 보기` : undefined}
                aria-pressed={onRegion ? region === event.regionCode : undefined}
                onClick={() => onRegion?.(region === event.regionCode ? "" : event.regionCode)}
                onKeyDown={(keyEvent) => {
                  if (onRegion && (keyEvent.key === "Enter" || keyEvent.key === " ")) {
                    keyEvent.preventDefault();
                    onRegion(region === event.regionCode ? "" : event.regionCode);
                  }
                }}
              >
                <circle r="22" fill="transparent" />
                <circle
                  r={region === event.regionCode ? 16 : 11}
                  fill="#ff925922"
                />
                <circle r="5" fill="#ff9259" stroke="white" strokeWidth="2" />
                <text
                  className="map-region-dot__label"
                  x={location[0] > 385 ? -15 : 15}
                  y={location[1] < 45 ? 26 : -16}
                  textAnchor={location[0] > 385 ? "end" : "start"}
                  aria-hidden="true"
                >
                  {event.region}
                </text>
              </g>
            );
          })}
        {selected && (
          <g transform={`translate(${selected[0]},${selected[1]})`}>
            <circle r="15" fill="#2359e622" />
            <circle r="6" fill="#2359e6" stroke="white" strokeWidth="2" />
          </g>
        )}
      </svg>
      {failed ? (
        <p className="map-help" role="alert">
          {t("지도를 불러오지 못했어요.")}{" "}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t("다시 시도")}</button>
        </p>
      ) : showHelp ? (
        <p className="map-help">
          {!geometry
            ? t("지도 불러오는 중…")
            : onPick
              ? t("지도를 눌러 행사 위치를 지정해주세요.")
              : t("지역을 누르면 그곳의 행사를 모아볼 수 있어요.")}
        </p>
      ) : null}
    </div>
  );
}
