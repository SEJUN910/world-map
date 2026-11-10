# FESTIVA

가입 없이 포스터 한 장으로 우리 동네 행사와 축제를 공유하는 Next.js 서비스입니다.

## 실행

Node.js 20.9 이상(검증 환경: Node.js 24)이 필요합니다.
Vercel 배포는 Node.js 24.x로 고정합니다. [GitHub → Vercel 배포 안내](docs/DEPLOY_VERCEL.md)를 참고하세요.

```powershell
npm install
npm run dev
```

http://127.0.0.1:3000 에서 확인합니다. `.env.example`을 참고해 `.env.local`에 프로젝트 URL과 공개용 publishable key를 설정합니다. 현재 로컬 환경은 서울 리전의 FESTIVA 프로젝트 `mgkocrlncpomhdaoxxqh`에 연결되어 있습니다. 앱에는 관리 토큰이나 service-role key가 필요하지 않습니다.

## 동작

- 지구본 → 한국·대만 지도 → 지역·검색·페이지별 실제 공개 행사 탐색. 지도는 현재 목록 페이지와 무관하게 조건에 맞는 공개 행사의 좌표를 최대 5,000개까지 표시합니다. 가까운 점은 묶이며, 확대하거나 누르면 확인할 수 있습니다.
- 행사 카드·지도 포스터를 누르면 원본 이미지, 일정·장소·주소, 소개, 공식 안내·출처와 신고 기능을 담은 모달이 열립니다. 닫기·바깥 클릭·Esc를 지원합니다. 별도 행사 상세 화면은 없으며 `/korea?event=행사ID`로 지도 위에서 모달을 바로 열 수 있습니다. 기존 `/events/ID/슬러그` 주소는 이 모달 주소로 이동합니다.
- 새 행사 등록은 ① 위치 선택 → ② 포스터·내용의 두 단계입니다. 주소 검색이나 직접 지정으로 위치를 정해야 다음 단계로 넘어갑니다. 돌아가도 포스터·소개 등 입력 내용은 유지되고, 기존 행사 수정은 두 번째 단계부터 시작합니다. 주소 검색으로 지역·좌표가 자동 입력되고 장소명이 비어 있으면 함께 채웁니다. 주소를 수정하면 이전 좌표를 지워 재선택하도록 합니다.
- 행사 소개는 필수이며 Tiptap 편집기로 최대 20,000자까지 작성합니다. 소제목·굵게·기울임·밑줄·목록·인용·링크·구분선·실행 취소를 지원하며, 단계 이동 후에도 서식이 유지됩니다. 본문은 `description_content` JSON과 일반 텍스트 `description`을 함께 저장하고 모달과 작성자 화면에서 서식을 표시합니다. 기존 일반 텍스트 소개는 변환 없이 계속 표시됩니다. 본문 이미지·임베드·임의 HTML은 지원하지 않습니다.
- 지역·장소명·공식 링크는 선택입니다. 주소 검색으로 채워진 지역·장소명은 수정하거나 비울 수 있으며, 좌표만 정해져 있어도 소개와 함께 저장할 수 있습니다. 지역이 비어 있는 행사는 전체 지도·목록에는 표시하되 빈 지역 필터나 지역 사이트맵 주소를 만들지 않습니다.
- 비회원 식별은 첫 저장/신고 때 자동 처리합니다. 선택적으로 Google로 가입·로그인할 수 있으며, 이메일·비밀번호 입력이나 가입 인증 메일은 필요하지 않습니다. 실제 Google OAuth 키 설정 전에는 로그인 버튼이 비활성화됩니다. [Google 설정 안내](docs/GOOGLE_AUTH.md)를 참고하세요.
- 비회원 초안·수정·공개 전환·삭제는 작성한 브라우저에서 가능합니다. 해당 브라우저에서 Google로 로그인하면 행사와 포스터 소유권이 계정에 연결되어 다른 기기에서도 관리할 수 있습니다. 로그인 전에 방문자 쿠키를 지우면 수정 권한을 잃을 수 있습니다. 이전 localStorage 초안은 자동 업로드하지 않습니다.
- 초안은 Supabase에 저장되며 다른 방문자가 읽을 수 없습니다. 이전 localStorage 초안은 `/me/local-drafts`에서 확인하고 새 등록 화면으로 가져올 수 있습니다. 자동 삭제하거나 공개하지 않습니다.
- 등록 폼의 ‘비공개로 저장’은 초안 상태로 보관하는 기능입니다. 공개 지도에 표시되지 않고, ‘내 행사’에서 수정 후 공개할 수 있습니다. 자동 저장은 아닙니다.
- 실제 공개 데이터만 메인·목록·모달·검색에 표시합니다. 사이트맵에는 메인·한국·대만·한국 지역과 공개 행사 모달 주소를 포함하며 언어별 대체 주소를 제공합니다. 비공개·삭제·종료된 행사는 사이트맵에서 제외합니다. 예시 행사/콘셉트 포스터는 제거했습니다.
- 한국관광공사 TourAPI의 진행 중·예정 행사를 대표 이미지와 함께 표시합니다. 대표 이미지는 행사 포스터 또는 현장 사진일 수 있습니다. 상세에는 출처·기준일·이미지 이용조건을 표시하며 종료된 공공 행사는 탐색·지역 목록·사이트맵에서 제외합니다.
- 행사 신고는 방문자별 행사당 1회 접수할 수 있습니다. 별도 관리자 화면은 없으며 신고 처리는 Supabase Dashboard에서 진행합니다.
- AI 포스터 자동 추출은 아직 연결하지 않았습니다. 직접 입력으로 등록할 수 있습니다.

### 지도 데이터

모바일 하단 포스터 목록은 기본으로 접혀 있습니다. ‘포스터 보기’를 누르면 124px 높이의 가로 썸네일 목록이 열리고, 다시 누르면 접힙니다. 포스터를 누르면 기존 행사 소개 모달이 열립니다. 지역 선택은 상단 바 바로 아래에서 항상 사용할 수 있습니다. PC 포스터 목록은 기본으로 표시합니다.

첫 화면과 한국·대만 탐색 화면은 같은 MapLibre GL JS 구형 지구를 사용합니다. 흰 배경에 파란 위경도 격자, 옅은 대륙 면과 윤곽, 행사 좌표를 표시합니다. 드래그로 회전하고 휠·핀치로 확대하며, 나라 선택 시 해당 국가 좌표로 접근합니다. ◎ 버튼으로 지구 전체 보기로 돌아갑니다. 탐색 화면은 로컬 Natural Earth 지리 데이터를 사용하므로 외부 지도 타일을 요청하지 않습니다. 대륙 윤곽은 단순화된 데이터여서 확대해도 골목·건물·상세 해안선은 나타나지 않습니다. 포스터 패널은 접을 수 있고, 모바일에서는 아래쪽 가로 목록으로 표시됩니다.

지도 점은 크기를 유지한 주황색 원으로 표시합니다. 확대 단계 6부터 각 점 위에 48px 원형 포스터 한 장이 나타나고 7에서 선명해집니다. 묶인 점은 해당 묶음의 행사 한 장을 대표로 보여주며, 더 확대하면 개별 행사로 나뉩니다. 겹침을 피한 화면 내 최대 36개만 표시하며 `/api/map-posters`에서 해당 공개 행사의 이미지·소개 정보를 가져옵니다. 이미지 링크는 필요할 때만 발급하고 브라우저 메모리에 최대 4분간 보관합니다. 마우스·키보드 포커스로 행사명·장소·기간을 확인하고, 클릭·탭하면 소개 모달이 열립니다. 축소하면 포스터가 사라지고 주황색 점이 남습니다.

묶인 큰 점에 마우스를 올리면 행사 수와 최대 5개 행사명을 미리 보여줍니다. 큰 점이나 그 점의 원형 대표 포스터를 누르면 자동 확대 대신 묶음 전체의 포스터 목록이 열립니다. 목록은 24개씩 페이지를 넘기며 탐색하고, 행사를 누르면 소개 모달이 열립니다. 소개를 닫으면 목록과 보던 페이지가 유지됩니다. 첫 화면의 지구에서도 동일하게 동작합니다.

확대 후 포스터 표시 간격 때문에 가려지는 주변 점도 대표 포스터의 묶음에 포함합니다. 여러 행사인 포스터는 주황색 개수 배지를 붙이고 호버 시 행사명들을 보여주며, 클릭하면 가려진 점의 행사까지 합친 목록을 엽니다. 실제 한 행사만 있는 포스터는 바로 소개를 엽니다.

등록 폼의 위치 선택 지도는 OpenStreetMap의 표준 타일 서버를 사용하며 출처가 표시됩니다. 공용 타일 서버는 제공이 보장되지 않고 사용량이 제한되므로, 공개 운영 전 적절한 타일 제공자를 선정하세요. 운영 환경에서는 `MAP_TILE_URL`(HTTPS의 `{z}/{x}/{y}` URL)과 `MAP_TILE_ATTRIBUTION`을 함께 설정해 위치 선택용 타일 제공자를 교체할 수 있습니다. 설정은 서버에서 런타임에 읽습니다. 제공자의 데이터·표시 조건과 이용 한도를 확인해야 합니다. 기존에 수집된 행사 좌표를 자동으로 보정하지는 않습니다.

### 주소 검색

Geoapify에서 발급받은 키를 서버 환경변수 `GEOAPIFY_API_KEY`에 설정하고 서버를 재시작합니다. `NEXT_PUBLIC_` 접두사는 사용하지 않습니다. 브라우저는 `/api/geocode`에 주소만 POST하고, 서버가 Geoapify에 조회하여 최대 5개의 후보 주소·좌표·지역·장소명을 돌려줍니다. 검색 버튼 또는 Enter로만 요청하며 로그인이나 가입은 필요하지 않습니다. 주소 범위·도시 수준의 결과를 고르면 대략적인 위치임을 알리고 확인용 지도를 펼칩니다. 검색 결과에 Geoapify·OpenStreetMap 출처를 표시합니다.

위치 입력은 주소 검색창, 작은 출처 링크, 접힌 확인용 지도를 하나의 영역으로 표시합니다. 중복 성공 안내는 생략하고 검색 실패·대략적 위치 등의 필요한 안내만 보여줍니다. 위치 확인 지도는 200~220px 크기로 격자·실시간 좌표 표시를 숨기며, 직접 좌표 입력은 추가로 펼칠 수 있습니다. 탐색용 지구의 격자·좌표 표시는 유지합니다.

등록·주소 검색은 대한민국(kr)과 대만(tw)을 지원합니다. 국가별 좌표 범위와 시간대(Asia/Seoul, Asia/Taipei)를 DB와 앱에서 함께 검증하며 국가를 바꾸면 이전 주소·좌표가 초기화됩니다. 서버는 제한된 메모리 캐시(최대 256개, 1시간)와 인스턴스 단위 요청 제한(IP별 분당 12회, 전체 분당 120회)을 적용합니다. 다중 인스턴스에서 전체 사용량을 일괄 제한하려면 배포 환경의 공통 제한 장치를 추가해야 합니다. API 키나 제공자의 원본 오류 응답은 클라이언트로 반환하지 않습니다.

## 데이터와 권한

`supabase/migrations/`의 마이그레이션을 현재 프로젝트에 적용했습니다.

| 테이블/뷰         | 용도                                        |
| ----------------- | ------------------------------------------- |
| `visitors`        | 개인정보 없는 방문자 식별자                 |
| `events`          | 행사 정보·작성자·초안/공개/숨김/삭제 상태   |
| `event_images`    | 행사당 포스터 한 장과 저장 경로             |
| `reports`         | 신고 사유와 처리 상태                       |
| `extraction_jobs` | 향후 서버 전용 AI 작업 상태·결과            |
| `event_regions`   | 공개 행사가 있는 지역 목록(RLS를 따르는 뷰) |

모든 테이블에 RLS를 적용했습니다. 공개 행사는 누구나 조회하고, 초안은 작성자만 조회·수정합니다. 숨김 상태는 작성자가 해제할 수 없습니다. 작성자 ID의 직접 변경은 금지되며, 검증된 Google 계정으로 비회원 행사를 연결하는 일회용 소유권 이전 함수만 예외입니다. AI 작업 생성/수정은 일반 방문자에게 허용하지 않습니다.

포스터는 비공개 `event-posters` 버킷의 `<방문자ID>/<행사ID>/<파일ID>.jpg` 경로에 저장합니다. 버킷 자체는 JPG·최대 10MB를 허용합니다. 앱에서 고르는 원본은 10MB까지이며 최대 1200px JPEG로 변환한 후 전송 파일을 3MB 이하로 제한합니다. 서버 액션 전체 상한은 4MB로 Vercel 배포 제한을 고려했고, 서버에서도 크기·타입·서명을 검사합니다. 업로드 소유권, 이미지 연결, 공개 시 실제 파일 존재를 DB/Storage에서도 확인합니다. 교체된 기존 이미지는 정리합니다.

공공데이터 행사는 방문자 작성자가 없습니다. TourAPI 행사는 한국관광공사 원본 이미지 URL과 이용유형이 있어야 저장됩니다. 원본 이미지는 변경하지 않고 표시하며 출처와 이용유형을 상세에 표시합니다. DB 제약과 RLS로 일반 사용자의 공공 출처 위조 및 공공 행사 수정을 제한합니다. 사용자 등록 행사에는 기존 포스터 공개 조건이 그대로 적용됩니다.

### 공공 축제 수집

한국관광공사 TourAPI를 사용하려면 공공데이터포털에서 [국문 관광정보 서비스_GW](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578) 활용 신청 후 인증키를 `.env.local`의 `TOUR_API_SERVICE_KEY`에 입력합니다. Encoding 또는 Decoding 키를 사용할 수 있습니다. 서버 전용 값이므로 `NEXT_PUBLIC_` 접두사를 붙이거나 저장소에 올리지 않습니다. 호스팅 시에도 서버 환경변수에 별도로 설정합니다.

`npm run import:tourapi`는 공식 API에서 지난 1년부터 시작한 행사 중 진행 중·예정인 항목을 조회하고, 제목·일정·좌표·원본 이미지 주소/이용유형 및 이미지 응답을 확인하는 읽기 전용 실행입니다. API 호출량을 사용합니다. 포스터/사진이 없거나 제공 이미지가 열리지 않으면 해당 행사는 수집 대상에서 제외합니다. AI 대체 이미지 기능은 아직 구현하지 않았습니다.

반영은 관리 환경에 `SUPABASE_IMPORT_PROJECT_REF`와 `SUPABASE_IMPORT_SERVICE_KEY`를 일시적인 환경변수로 지정한 뒤 `npm run import:tourapi -- --apply`로 실행합니다. 프로젝트 URL과 프로젝트 ID가 일치해야 합니다. 서비스 키는 저장소·브라우저·공개 환경변수에 넣지 마세요. 재실행은 TourAPI 콘텐츠 ID를 기준으로 갱신하며 숨김/삭제 상태를 복구하지 않습니다. 원본에서 사라진 행사를 자동 삭제하지 않습니다. 이미지 URL은 한국관광공사 서버를 가리키므로 원본 서비스에 따라 나중에 변경되거나 사용할 수 없을 수 있습니다.

기존 전국문화축제표준데이터 64건은 TourAPI 이미지와 공개 조회 검증 후 소프트 삭제했습니다. `import:festivals`는 예전 데이터 확인 용도로만 남기고 쓰기 기능을 막았습니다. 사용자 등록 행사는 그대로 유지합니다. 아직 정기 수집 일정은 설정하지 않았으므로 새 행사와 원본 변경 사항을 가져오려면 TourAPI 수집을 다시 실행해야 합니다.

공개 행사와 작성자에게만 5분짜리 이미지 URL을 발급합니다. 이미 발급된 링크는 행사를 비공개로 바꾼 뒤에도 남은 만료 시간 동안 유효할 수 있습니다. 삭제는 행사 상태를 `deleted`로 바꾸는 방식이며 공개 목록·상세·사이트맵에서 즉시 제외됩니다. 파일의 최종 보존/삭제 운영은 별도로 관리합니다.

## 검증

```powershell
npm run build
npm test
npm run typecheck
npm run check:supabase
npm run start
# 서버가 실행 중인 별도 터미널에서
npm run test:smoke
```

`npm run test:integration`은 실행 중인 프로덕션 서버와 개발 Supabase 프로젝트를 대상으로 실제 등록/수정/공개/비공개/신고/RLS를 검사합니다. 별도 프로세스 환경에 `SUPABASE_TEST_PROJECT_REF`와 `SUPABASE_TEST_SERVICE_KEY`를 명시해야 실행됩니다. 서비스 키는 합성 테스트 방문자 생성·역할 지정·정리에만 사용하고 앱 코드에는 사용하지 않습니다. 테스트는 메일을 보내지 않으며 자신이 만든 방문자·행사·파일만 정리합니다. 서버 액션 전송 검사는 현재 고정된 Next.js 버전의 프로덕션 빌드를 사용합니다.

## 구조

```text
src/app/                  공개/개인 행사 페이지, 서버 액션, 신고 관리
src/components/           지구본·지도·검색·등록·관리 화면
src/lib/event-repository.ts 실제 Supabase 조회와 포스터 URL 생성
src/lib/event-validation.ts 입력 검증과 한글 슬러그 생성
src/lib/supabase/          타입·클라이언트·방문자 세션·쿠키 갱신
src/lib/drafts.ts          이전 브라우저 초안 읽기와 이미지 처리
src/proxy.ts              방문자 쿠키 갱신
supabase/migrations/      적용한 데이터베이스·RLS·Storage SQL
public/assets/            Natural Earth 세계/한국 지도 데이터
scripts/                  단위·실서버·실DB 검증
docs/WORK_LOG.md           프로젝트 작업 기록
```

## 운영

별도 관리자 페이지와 관리자 암호 로그인은 제거했습니다. 신고 처리가 필요하면 Supabase Dashboard의 `reports`를 확인하고 해당 `events.publication_status`를 `hidden`으로 변경합니다. 일반 방문자의 DB 권한과 RLS는 유지합니다.

방문자를 읽기 전용 탐색 때 미리 생성하지 않습니다. Supabase의 익명 세션 생성 제한을 유지하며, 실제 브라우저 요청으로 생성해 IP별 제한이 적용되도록 합니다. 사용하지 않는 익명 방문자 정리 시 게시물 작성자를 일괄 삭제하지 않도록 주의해야 합니다. 방문자 쿠키를 영구적인 계정 복구 수단으로 취급하지 않습니다.

사용자 Codex 설정의 `supabase_festiva`는 공식 로컬 stdio MCP 0.15.0으로 이 프로젝트에만 연결됩니다. 실행 파일과 관리 인증정보는 저장소 밖 사용자 `.codex`에 보관합니다. 설정 변경 후에는 새 세션/앱 재시작이 필요합니다.

아직 사이트를 배포하지 않았습니다. 공개 전 `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 지정하고 Next.js 서버 호스팅을 연결해야 합니다. `.openai/hosting.json`에는 기존 Sites 프로젝트 ID만 보존합니다. 지리 데이터는 Natural Earth 110m 세계/50m 한국 데이터이며 외부 폰트나 런타임 CDN은 사용하지 않습니다.

## Taiwan seed data

`/taiwan` uses country-scoped events/regions and the same globe and introduction modals. The home globe displays both countries. `data/taiwan-events.json` contains six curated English introductions based on the Taiwan Tourism Administration activity open dataset (https://data.gov.tw/en/datasets/7778), with original official images, source attribution, reference date and OGDL-1.0 licensing. These are representative images and may be photos rather than edition-specific posters.

Run `node scripts/import-taiwan.mjs` to validate current records and check all image URLs. `--sql OUTPUT_FILE` writes an upsert for review/application through the existing project database MCP; it does not execute SQL or require a service key. Repeat imports preserve hidden/deleted publication states and do not remove unrelated records. Refresh the curated source records when their dates expire; no automatic scheduler has been added.

## UI languages

The UI supports Korean (default), English and Traditional Chinese. The language control is available on the main screen and inside registration/detail/group dialogs. Selection is stored in the `festiva-language` cookie for one year; server content and the HTML language use the same preference. Switching languages preserves the current map camera, filters and unsaved registration fields. Language selection updates `?lang=ko|en|zh-TW` while retaining event/filter/page parameters. Explicit URL language overrides the cookie, and canonical/hreflang links expose each version to crawlers. Event content remains original; UI translation does not translate submitted titles, descriptions or addresses.

Add UI copy in `src/lib/i18n/messages.ts` as Korean/English/Traditional Chinese triples. Use `useTranslations()` in client components and `getTranslations()` on the server. Unit tests validate dictionary keys, values and interpolation placeholders. No external translation service is required.

## First-party traffic and event analytics

공개 탐색 화면에 오늘 방문자·누적 페이지 조회·누적 행사 조회를 작은 글씨로 표시합니다. PC 국가 지도에서는 좌상단 국가명에 이어 표시하고, 모바일에서는 검색·설정 패널을 열었을 때 표시합니다. 모바일 지도 상단은 뒤로가기·브랜드·검색·설정·행사 추가만 남기고, 검색·계정·언어·포스터 접기는 아이콘을 눌러 여는 상단 패널에 모았습니다. 지역 선택은 패널 밖, 상단 바 바로 아래에서 가로 스크롤로 항상 이용할 수 있습니다. 패널은 기존 상단 줄을 덮으며 닫기·바깥 클릭·Esc를 지원하고 검색 입력은 닫았다 열어도 유지합니다. 좌하단 좌표와 통계는 겹치지 않습니다. 관리자 페이지·암호 입력은 없으며 누구나 세 집계를 볼 수 있습니다. 한국 시간 기준이고 방문자는 브라우저 추정치입니다. 동시 접속자 수가 아닙니다. 집계가 표시되는 동안 약 1분 간격으로 갱신하며 조회 실패 시 숫자를 만들어 표시하지 않습니다.

Public route navigation (`/`, `/korea`, `/taiwan`, normalized `/regions`) records a page view; language changes, prefetches and filter-only URL updates do not. An event view records only after opening the introduction modal; the database counts each public event once per session. Tracking cookies are HttpOnly: a one-year browser ID and a session ID expiring after thirty minutes without a collected hit. Requests are serialized to avoid assigning multiple identities before the initial cookies arrive. Localhost, Vercel previews, common bot agents, hidden pages and DNT/GPC opt-outs are excluded. Set `ANALYTICS_INCLUDE_LOCAL=true` only when explicitly testing ingestion, then remove it.

Applied `202611100004_analytics.sql` and `202611100006_public_traffic.sql`. Raw analytics/settings tables remain inaccessible to clients. `/api/traffic` returns only three validated numeric totals through a key-protected RPC, with server/CDN caching; the former detailed dashboard RPC was removed. Only the SHA-256 hash of `ANALYTICS_WRITE_KEY` is stored in `analytics_settings`. Keep this server-only key in the hosting environment; rotating it requires updating the database hash too. No administrator password, service-role key or Google account is needed for these public counters.

No raw IP, full URL/query, user agent, event content or Supabase visitor/account ID is stored. Browser/session identities are HMAC hashes, and referrers contain hostnames only; none are returned by the public counters. Ingestion validates bounded allowlisted payloads, requires the same origin, and applies per-instance throttling. This is not a fraud-proof advertising billing system. Raw hit storage currently has no scheduled retention cleanup; review storage/retention as traffic grows.

## Search and social sharing

Public home/country/region pages and event modal URLs have localized titles/descriptions, self-consistent canonical URLs, reciprocal language alternates, Open Graph and Twitter metadata. Paginated listings retain their page number in the canonical; internal search/empty results/unknown regions and past events are noindex. Region filters are crawlable links. Direct `/korea?event=ID&lang=ko` or `/taiwan?event=ID&lang=en` requests focus on one event and server-render an open introduction dialog with the event as the main heading; no standalone detail page was restored. Closing returns to discovery. JavaScript-enhanced interactions retain the existing modal design.

JSON-LD describes the website, collection lists and breadcrumbs. A direct event URL emits Event data only when dates and a real address are available. No prices, free entry, organizers or ticket availability are invented. Structured data makes the content understandable; rich-result display remains a search-engine decision. `/images/events/ID` resolves a current public poster through a no-store redirect, keeping short-lived Supabase signatures out of indexed metadata. `/og` provides the default 1200?630 social image, with an SVG brand favicon.

`sitemap.xml` includes current public event URLs, real update dates and language alternates; private/hidden/deleted/expired records are excluded. Robots excludes private/admin/API paths. Local builds and Vercel previews are noindex; previews also receive an X-Robots-Tag. Set `NEXT_PUBLIC_SITE_URL` to the final public HTTPS origin before building/deploying. Vercel's project production domain is a fallback; arbitrary request/preview hosts are never used as canonical origins. There is no public deployment yet.

After deployment, register the actual domain with Google Search Console and Naver Search Advisor, configure optional `GOOGLE_SITE_VERIFICATION` and `NAVER_SITE_VERIFICATION` token values, redeploy, and submit `/sitemap.xml`. These accounts/domain ownership have not been registered by the agent. Verify a country URL and an event URL with URL Inspection/Rich Results Test after the live site is reachable.
