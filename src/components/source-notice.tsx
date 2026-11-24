"use client";
import type { CountryCode } from "@/lib/countries";
import { useTranslations } from "./language-provider";

// Country-level data attribution under the event list (ODbL requires it for Paris).
export function SourceNotice({ country }: { country: CountryCode }) {
  const { t } = useTranslations();
  if (country !== "fr") return null;
  return <p className="source-notice">
    {t("행사 정보는 파리시 ‘Que faire à Paris’ 공개데이터(ODbL)를 사용합니다. 행사 내용은 프랑스어 원문입니다.")}{" "}
    <a href="https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/" target="_blank" rel="noopener noreferrer">{t("파리시 행사 정보")} ↗</a>
    {" · "}<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a>
  </p>;
}
