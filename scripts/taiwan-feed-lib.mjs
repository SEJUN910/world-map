// Pure helpers for scripts/import-taiwan-feed.mjs (unit-tested in taiwan-feed.test.mjs).

// Image hosts the site may show for this source. Same list as the database check
// (202611270001_taiwan_feed.sql), RESIZABLE_POSTER_HOSTS and the CSP. khh.travel is
// left out: it refuses requests from outside Taiwan, so its images never load here.
export const TAIWAN_IMAGE_HOST = /^https:\/\/(?:(?:[a-z0-9-]+\.)+(?:gov\.tw|taiwan\.net\.tw)|kinmen\.travel|hualien\.travel|newtaipei\.travel|www\.twtainan\.net|www\.ali-nsa\.net)\/\S+$/;

// City/county → the English name and code already used by the curated entries.
const CITIES = {
  臺北市: "Taipei", 新北市: "New Taipei", 基隆市: "Keelung", 桃園市: "Taoyuan", 新竹市: "Hsinchu City", 新竹縣: "Hsinchu County",
  苗栗縣: "Miaoli", 臺中市: "Taichung", 彰化縣: "Changhua", 南投縣: "Nantou", 雲林縣: "Yunlin", 嘉義市: "Chiayi City",
  嘉義縣: "Chiayi County", 臺南市: "Tainan", 高雄市: "Kaohsiung", 屏東縣: "Pingtung", 宜蘭縣: "Yilan", 花蓮縣: "Hualien",
  臺東縣: "Taitung", 澎湖縣: "Penghu", 金門縣: "Kinmen", 連江縣: "Lienchiang",
};
export function taiwanRegion(city) {
  const name = CITIES[String(city ?? "").trim().replace(/^台/, "臺")];
  return name ? { region: name, code: `tw-${name.toLowerCase().replace(/\s+/g, "-")}` } : null;
}

const stamp = (value) => /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(String(value ?? ""));
/** The calendar day of a feed timestamp, as written. */
export function taiwanDay(value) { return stamp(value)?.[1] ?? null; }
/**
 * Start and end days of a record. About a fifth of the records store local midnight as
 * the UTC instant but label it +08:00: a "…T16:00:00+08:00" start paired with a
 * "…T15:59:59+08:00" end means the next day's 00:00 to that end day's 23:59. Only that
 * pair is shifted; a lone 16:00 start is a real 4 pm start.
 */
export function taiwanDates(startValue, endValue) {
  const start = stamp(startValue), end = stamp(endValue);
  if (!start || !end) return null;
  let startDate = start[1];
  if (start[2] === "16:00:00" && end[2] === "15:59:59") {
    const next = new Date(`${startDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    startDate = next.toISOString().slice(0, 10);
  }
  return { startDate, endDate: end[1] };
}

// Not events a visitor plans around: notices, apps, stamp or point campaigns, travel
// subsidies, giveaways and shopping promotions, tour packages, tentative listings,
// calls for entries, classes and talks. The owner may loosen this; it is editorial.
const NOT_AN_EVENT = /公告|管制|封閉|停駛|(?<![A-Za-z])APP(?![A-Za-z])|集點|集章|徵件|徵選|徵稿|招募|報名|講座|課程|研習|工作坊|抽獎|抽好禮|好禮|好康|優惠|補助|加碼|稅月|購物節|購節|遊程|預計/;
// The same, read from the start of the description (lotteries hide behind festival names).
const NOT_AN_EVENT_TEXT = /摸彩|抽獎|登錄發票|發票登錄|集點|集章|兌換|活動公告/;
/** True when the description shows a campaign, not an event. */
export function campaignText(description) { return NOT_AN_EVENT_TEXT.test(String(description ?? "").slice(0, 120)); }
// Long-running items (all-year passes, permanent shows) crowd out dated events.
const MAX_DAYS = 200;

const has = (title, pattern) => pattern.test(title);
/** Keep/skip, then category and tags from the (Chinese) title. */
export function classifyTaiwanEvent(title, startDate, endDate) {
  if (NOT_AN_EVENT.test(title)) return { keep: false, reason: "notice, app, campaign or class" };
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
  if (!(days >= 0) || days > MAX_DAYS) return { keep: false, reason: "longer than 200 days" };
  const tags = new Set();
  if (has(title, /音樂|演唱|爵士|搖滾|樂團|交響|擊樂/)) tags.add("concert");
  if (has(title, /戲劇|劇場|劇團|歌仔戲|布袋戲|收冬戲|酬神|野台戲/)) tags.add("theater");
  if (has(title, /舞蹈|舞團|跳舞/)) tags.add("dance");
  if (has(title, /燈會|燈節|光節|燈光|光影|夜訪|夜遊|星空|煙火|跨年|耶誕城|聖誕城/)) tags.add("night");
  if (has(title, /市集/)) tags.add("flea-market");
  if (has(title, /美食|小吃|料理|茶|咖啡|酒/)) tags.add("food");
  if (has(title, /馬拉松|路跑|自行車|單車|鐵人|衝浪|泳渡|登山/)) tags.add("sport");
  if (has(title, /親子|兒童|童玩|孩/)) tags.add("kids");
  if (has(title, /花季|花海|賞花|生態|賞鳥|螢火蟲|步道|古道|蝴蝶|紫斑蝶|賞蝶|芒花|森林/)) tags.add("nature");
  if (has(title, /古蹟|歷史|文化資產|老街|廟會|媽祖|遶境|巡安/)) tags.add("history");
  if (has(title, /攝影/)) tags.add("photo");
  if (has(title, /電影|影展/)) tags.add("film");
  if (has(title, /書法|畫展|水墨|油畫|彩墨/)) tags.add("painting");
  let category = "other";
  // Order matters: a "音樂祭" is a festival with a concert tag, a "城市展" an exhibition.
  if (has(title, /節|祭|嘉年華|燈會|跨年|花季|季$|慶典|廟會|遶境|巡安|耶誕|聖誕/)) category = "festival";
  else if (has(title, /(?<![發開進拓擴伸])展(?![開現演])/)) category = "exhibition";
  else if (tags.has("concert") || tags.has("theater") || tags.has("dance") || has(title, /音樂會|表演|演出/)) category = "performance";
  if (category === "festival") tags.add("festival");
  if (category === "exhibition") tags.add("exhibition");
  return { keep: true, category, tags: [...tags].slice(0, 12) };
}

/** Same event listed by several agencies: compare titles without the year, spaces and punctuation. */
export function duplicateKey(title, region) {
  return `${region}:${String(title).normalize("NFKC").replace(/台/g, "臺").replace(/20\d{2}(?:\s*[-–~]\s*20\d{2})?|115年|116年/g, "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase()}`;
}
