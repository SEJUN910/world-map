import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, decodeEntities, normalizeRegion, sameEvent, selectRule, xmlText } from "./cultureinfo-lib.mjs";

test("double-encoded titles decode once fully; bad code points are dropped", () => {
  assert.equal(decodeEntities("[대학로] 연극 &amp;lt;오백에 삼십&amp;gt;"), "[대학로] 연극 <오백에 삼십>");
  assert.equal(decodeEntities("A &amp;amp; B"), "A & B");
  assert.equal(decodeEntities("x&#0;y&#99999999;z&#xD800;"), "xyz");
  assert.equal(decodeEntities("&#44032;&#x2014;&nbsp;"), "가— ");
});

test("province spellings map to the names the TourAPI import stores", () => {
  for (const [input, expected] of [["서울", "서울특별시"], ["서울시", "서울특별시"], ["서울특별시", "서울특별시"], ["광주", "전남광주통합특별시"], ["전남", "전남광주통합특별시"], ["전남광주통합", "전남광주통합특별시"], ["전북", "전북특별자치도"], ["전라북도", "전북특별자치도"], ["강원", "강원특별자치도"], ["경북", "경상북도"], ["세종", "세종특별자치시"], ["제주", "제주특별자치도"]]) assert.equal(normalizeRegion(input), expected, input);
  for (const input of ["", "전국", "종로구", "toString", "__proto__", null]) assert.equal(normalizeRegion(input), null, String(input));
});

test("festivals and exhibitions up to 180 days, performances up to 90, nothing else", () => {
  assert.ok(selectRule("행사/축제", "2026-12-01", "2027-05-30"));
  assert.equal(selectRule("행사/축제", "2026-12-01", "2027-06-30"), null);
  assert.ok(selectRule("전시", "2026-12-01", "2027-03-01"));
  assert.ok(selectRule("연극", "2026-12-01", "2027-02-28"));
  assert.equal(selectRule("연극", "2015-11-21", "2026-12-31"), null, "open runs are left out");
  assert.equal(selectRule("음악/콘서트", "2026-12-01", "2027-03-15"), null);
  for (const realm of ["교육/체험", "아동/가족", "기타"]) assert.equal(selectRule(realm, "2026-12-01", "2026-12-02"), null, realm);
  assert.equal(selectRule("전시", "2026-12-02", "2026-12-01"), null);
});

test("a TourAPI duplicate needs close dates, a nearby venue and a similar title", () => {
  const festival = { title: "2026 화천산천어축제", startDate: "2027-01-09", endDate: "2027-01-31", latitude: 38.106, longitude: 127.708 };
  assert.equal(sameEvent({ title: "제17회 화천 산천어 축제", startDate: "2027-01-10", endDate: "2027-02-01", latitude: 38.11, longitude: 127.70 }, festival), true);
  assert.equal(sameEvent({ ...festival, title: "화천 겨울 음악회" }, festival), false, "different title");
  assert.equal(sameEvent({ ...festival, latitude: 37.5, longitude: 127.0 }, festival), false, "far away");
  assert.equal(sameEvent({ ...festival, startDate: "2027-03-01", endDate: "2027-03-20" }, festival), false, "different dates");
});

test("XML text keeps angle-bracketed titles, unwraps CDATA and drops only real HTML tags", () => {
  assert.equal(xmlText("[대학로] 연극 &amp;lt;오백에 삼십&amp;gt;"), "[대학로] 연극 <오백에 삼십>");
  assert.equal(xmlText("&lt;극장&gt; 2026 공연"), "<극장> 2026 공연");
  assert.equal(xmlText("A &amp;lt; B 그리고 C &amp;gt; D"), "A < B 그리고 C > D");
  assert.equal(xmlText("<![CDATA[축제 A]]>"), "축제 A");
  assert.equal(xmlText("&lt;p&gt;첫 줄&lt;/p&gt;&lt;p&gt;둘째 &amp;amp; 셋&lt;/p&gt;"), "첫 줄" + String.fromCharCode(10) + "둘째 & 셋");
});

test("a very short title never matches by containment alone", () => {
  const festival = { title: "서울 빛초롱 축제", startDate: "2026-12-12", endDate: "2027-01-04", latitude: 37.569, longitude: 126.978 };
  assert.equal(sameEvent({ ...festival, title: "축제" }, festival), false);
  assert.equal(sameEvent({ ...festival, title: "2026 서울빛초롱축제" }, festival), true);
});

test("realms map to one category and a tag", () => {
  assert.deepEqual(classify("행사/축제"), { category: "festival", tags: ["festival"] });
  assert.deepEqual(classify("전시"), { category: "exhibition", tags: ["exhibition"] });
  assert.deepEqual(classify("연극"), { category: "performance", tags: ["theater"] });
  assert.deepEqual(classify("국악"), { category: "performance", tags: ["gugak"] });
  assert.equal(classify("교육/체험"), null);
});
