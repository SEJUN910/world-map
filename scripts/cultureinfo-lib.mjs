// Pure helpers for scripts/import-cultureinfo.mjs (tested in cultureinfo.test.mjs).

const NAMED = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", middot: "·", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };
/** Decodes HTML entities, by default repeatedly: the listing double-encodes ("&amp;lt;"). Only real characters survive. */
export function decodeEntities(value, rounds = 3) {
  let text = String(value ?? "");
  for (let round = 0; round < rounds && /&(#x[0-9a-f]{1,8}|#\d{1,10}|[a-z]+);/i.test(text); round++) {
    text = text.replace(/&(#x[0-9a-f]{1,8}|#\d{1,10}|[a-z]+);/gi, (match, code) => {
      if (code[0] !== "#") return NAMED[code.toLowerCase()] ?? match;
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point >= 1 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff) ? String.fromCodePoint(point) : "";
    });
  }
  return text.replace(/\u0000/g, "");
}

/**
 * Plain text from an XML element's raw content. The XML layer is decoded once (or
 * a CDATA section unwrapped), real HTML tags are removed, then the remaining
 * entities are decoded, so a title like "&amp;lt;오백에 삼십&amp;gt;" keeps its
 * "<오백에 삼십>" instead of losing it as if it were a tag.
 */
export function xmlText(raw) {
  const value = String(raw ?? "");
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(value);
  const html = cdata ? cdata[1] : decodeEntities(value, 1);
  const withoutTags = html.replace(/<\s*(br|\/p|\/div|\/li)\b[^>]*>/gi, "\n").replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "");
  return decodeEntities(withoutTags).split("\n").map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim()).filter(Boolean).join("\n");
}

// Province names as stored by the TourAPI import, so both sources share region chips.
// Gwangju and South Jeolla are one province (전남광주통합특별시) in the current data.
const PROVINCES = {
  서울: "서울특별시", 서울시: "서울특별시", 서울특별시: "서울특별시",
  부산: "부산광역시", 부산시: "부산광역시", 부산광역시: "부산광역시",
  대구: "대구광역시", 대구시: "대구광역시", 대구광역시: "대구광역시",
  인천: "인천광역시", 인천시: "인천광역시", 인천광역시: "인천광역시",
  광주: "전남광주통합특별시", 광주시: "전남광주통합특별시", 광주광역시: "전남광주통합특별시",
  전남: "전남광주통합특별시", 전라남도: "전남광주통합특별시", 전남광주통합: "전남광주통합특별시", 전남광주통합특별시: "전남광주통합특별시",
  대전: "대전광역시", 대전시: "대전광역시", 대전광역시: "대전광역시",
  울산: "울산광역시", 울산시: "울산광역시", 울산광역시: "울산광역시",
  세종: "세종특별자치시", 세종시: "세종특별자치시", 세종특별자치시: "세종특별자치시",
  경기: "경기도", 경기도: "경기도",
  강원: "강원특별자치도", 강원도: "강원특별자치도", 강원특별자치도: "강원특별자치도",
  충북: "충청북도", 충청북도: "충청북도",
  충남: "충청남도", 충청남도: "충청남도",
  전북: "전북특별자치도", 전라북도: "전북특별자치도", 전북특별자치도: "전북특별자치도",
  경북: "경상북도", 경상북도: "경상북도",
  경남: "경상남도", 경상남도: "경상남도",
  제주: "제주특별자치도", 제주도: "제주특별자치도", 제주특별자치도: "제주특별자치도",
};
/** Maps a province spelling (full, short or legacy) to the stored province name, or null. */
export function normalizeRegion(name) {
  const key = String(name ?? "").replace(/\s+/g, "");
  return Object.hasOwn(PROVINCES, key) ? PROVINCES[key] : null;
}

const day = 86_400_000;
const RULES = [
  { realms: ["행사/축제"], maxDays: 180, category: "festival" },
  { realms: ["전시"], maxDays: 180, category: "exhibition" },
  // Performances only as dated runs: open runs and season-long shows are left out.
  { realms: ["음악/콘서트", "연극", "뮤지컬/오페라", "무용/발레", "국악"], maxDays: 90, category: "performance" },
];
// Fine-grained tag per realm (keys shared with the Paris import).
const REALM_TAGS = { "행사/축제": "festival", 전시: "exhibition", "음악/콘서트": "concert", 연극: "theater", "뮤지컬/오페라": "musical", "무용/발레": "dance", 국악: "gugak" };
/** Category and tags for a realm, or null when the realm is not imported. */
export function classify(realm) {
  const rule = RULES.find((candidate) => candidate.realms.includes(realm));
  return rule ? { category: rule.category, tags: [REALM_TAGS[realm]] } : null;
}
/** The selection rule an event falls under, or null (education, kids, other, or too long a run). */
export function selectRule(realm, startDate, endDate) {
  const length = (Date.parse(endDate) - Date.parse(startDate)) / day;
  if (!Number.isFinite(length) || length < 0) return null;
  return RULES.find((rule) => rule.realms.includes(realm) && length <= rule.maxDays) ?? null;
}

function normalizedTitle(title) {
  return String(title ?? "").normalize("NFKC").toLowerCase()
    .replace(/제\s*\d+\s*회/g, "").replace(/20\d{2}/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
}
function bigrams(value) {
  const set = new Set();
  for (let index = 0; index < value.length - 1; index++) set.add(value.slice(index, index + 2));
  return set;
}
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
/** Conservative duplicate check against a TourAPI festival: close dates AND nearby AND a similar title. */
export function sameEvent(item, festival) {
  const near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) <= 7 * day;
  if (!near(item.startDate, festival.startDate) || !near(item.endDate, festival.endDate)) return false;
  if (distanceKm(item, festival) > 2) return false;
  const a = normalizedTitle(item.title), b = normalizedTitle(festival.title);
  if (!a || !b) return false;
  // Containment only counts for titles long enough to mean something.
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;
  const x = bigrams(a), y = bigrams(b);
  let shared = 0;
  for (const gram of x) if (y.has(gram)) shared++;
  return x.size && y.size ? (2 * shared) / (x.size + y.size) >= 0.6 : false;
}
