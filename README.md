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

- 지구본 → 한국·대만·프랑스 지도 → 지역·검색·페이지별 실제 공개 행사 탐색. 지도는 현재 목록 페이지와 무관하게 조건에 맞는 공개 행사의 좌표를 최대 5,000개까지 표시합니다. 가까운 점은 묶이며, 확대하거나 누르면 확인할 수 있습니다.
- 행사 카드·지도 포스터를 누르면 원본 이미지, 일정·장소·주소, 소개, 공식 안내·출처와 신고 기능을 담은 모달이 열립니다. 닫기·바깥 클릭·Esc를 지원합니다. 별도 행사 상세 화면은 없으며 `/korea?event=행사ID`로 지도 위에서 모달을 바로 열 수 있습니다. 기존 `/events/ID/슬러그` 주소는 이 모달 주소로 이동합니다.
- 검색(`?q=`)은 단어마다(최대 4개, 모두 만족) 제목·지역·장소·주소를 찾고, 태그·분야 이름(한국어·영어·중국어 라벨, 예: 뮤지컬·musical·音樂劇 → musical 태그, 공연 → 공연 분야, ‘기타’는 제외)과 소개글도 봅니다. 소개글은 프랑스어 긴 글에서 엉뚱하게 걸리지 않도록 한글·한자 2자 이상, 영문 4자 이상 단어만 찾고, ‘무료/free/免費’는 파리의 ‘gratuit’도 찾습니다. ‘스트리트 아트’처럼 두 단어 라벨은 한 단어로 봅니다. 규칙은 `src/lib/event-search.ts` 한 곳에 있고 목록과 지도가 같이 씁니다. 정렬은 그대로입니다.
- 행사 소개 모달의 일정·장소 바로 아래에 `길찾기`와 `캘린더에 추가`가 있습니다. 길찾기는 좌표로 연결합니다: 한국은 네이버 지도·카카오맵·Google 지도(한국어 화면은 네이버 먼저), 그 밖의 나라는 Google 지도. 캘린더는 Google 캘린더 링크와 일정 파일(.ics)을 줍니다. 시각 정보가 없어 종일 일정이며 기기 시간대와 무관하게 날짜가 같습니다. 남은 기간이 7일 이하면 오늘부터 끝날까지, 더 긴 행사는 방문할 날 하루를 고릅니다. 일정 미정·종료·취소·연기 행사에는 캘린더 버튼이 없습니다. 규칙은 `src/lib/event-actions.ts`.
- 나라 화면 지도 오른쪽 위의 `내 주변 보기`(조준선 아이콘, 그 아래 지구본 아이콘은 지구 전체 보기)를 누르면 그때만 위치 권한을 묻고, 내 위치로 이동해 파란 점과 정확도 원을 그린 뒤 목록을 가까운 순 ‘내 주변 행사’로 바꿉니다(반경 10km, 없으면 30·50km, 행마다 ‘약 850m’). 지금의 검색어·기간·분야·태그는 유지되고 ‘전체 목록’이나 필터 변경으로 해제됩니다. 지역 페이지·영역 검색·공유된 행사 링크에서는 나라 전체로 넓혀 찾고, 다른 지원 나라에 있으면 그 나라 지도로 갈지 묻고, 지원하지 않는 곳이면 안내만 합니다. 권한 거부·실패·시간 초과·대략적 위치(1km 넘음, 10km 넘으면 거리 숨김)마다 안내가 뜹니다. 위치는 브라우저 안에서만 쓰며 저장·주소·서버·분석으로 보내지 않습니다(다른 화면으로 넘길 때만 10초 동안 메모리에 둠). `Permissions-Policy`는 `geolocation=(self)`. 나라 판별은 나라별 사각 범위라 후쿠오카는 한국, 바르셀로나는 프랑스로 잡힙니다. 첫 화면 지구본에는 없습니다. 규칙은 `src/lib/nearby.ts`.
- 새 행사 등록은 ① 위치 선택 → ② 포스터·내용의 두 단계입니다. 주소 검색이나 직접 지정으로 위치를 정해야 다음 단계로 넘어갑니다. 돌아가도 포스터·소개 등 입력 내용은 유지되고, 기존 행사 수정은 두 번째 단계부터 시작합니다. 주소 검색으로 지역·좌표가 자동 입력되고 장소명이 비어 있으면 함께 채웁니다. 주소를 수정하면 이전 좌표를 지워 재선택하도록 합니다.
- 행사 소개는 필수이며 Tiptap 편집기로 최대 20,000자까지 작성합니다. 소제목·굵게·기울임·밑줄·목록·인용·링크·구분선·실행 취소를 지원하며, 단계 이동 후에도 서식이 유지됩니다. 본문은 `description_content` JSON과 일반 텍스트 `description`을 함께 저장하고 모달과 작성자 화면에서 서식을 표시합니다. 기존 일반 텍스트 소개는 변환 없이 계속 표시됩니다. 본문 이미지·임베드·임의 HTML은 지원하지 않습니다.
- 지역·장소명·공식 링크는 선택입니다. 주소 검색으로 채워진 지역·장소명은 수정하거나 비울 수 있으며, 좌표만 정해져 있어도 소개와 함께 저장할 수 있습니다. 지역이 비어 있는 행사는 전체 지도·목록에는 표시하되 빈 지역 필터나 지역 사이트맵 주소를 만들지 않습니다.
- 비회원 식별은 첫 저장/신고 때 자동 처리합니다. 선택적으로 Google로 가입·로그인할 수 있으며, 이메일·비밀번호 입력이나 가입 인증 메일은 필요하지 않습니다. 실제 Google OAuth 키 설정 전에는 로그인 버튼이 비활성화됩니다. [Google 설정 안내](docs/GOOGLE_AUTH.md)를 참고하세요.
- 비회원 초안·수정·공개 전환·삭제는 작성한 브라우저에서 가능합니다. 해당 브라우저에서 Google로 로그인하면 행사와 포스터 소유권이 계정에 연결되어 다른 기기에서도 관리할 수 있습니다. 로그인 전에 방문자 쿠키를 지우면 수정 권한을 잃을 수 있습니다. 이전 localStorage 초안은 자동 업로드하지 않습니다.
- 초안은 Supabase에 저장되며 다른 방문자가 읽을 수 없습니다. 이전 localStorage 초안은 `/me/local-drafts`에서 확인하고 새 등록 화면으로 가져올 수 있습니다. 자동 삭제하거나 공개하지 않습니다.
- 등록 폼의 ‘비공개로 저장’은 초안 상태로 보관하는 기능입니다. 공개 지도에 표시되지 않고, ‘내 행사’에서 수정 후 공개할 수 있습니다. 자동 저장은 아닙니다.
- 실제 공개 데이터만 메인·목록·모달·검색에 표시합니다. 사이트맵에는 메인·한국·대만·한국 지역과 공개 행사 모달 주소를 포함하며 언어별 대체 주소를 제공합니다. 비공개·삭제·종료된 행사는 사이트맵에서 제외합니다. 예시 행사/콘셉트 포스터는 제거했습니다.
- 한국관광공사 TourAPI의 진행 중·예정 행사를 대표 이미지와 함께 표시합니다. 대표 이미지는 행사 포스터 또는 현장 사진일 수 있습니다. 상세에는 출처·기준일·이미지 이용조건을 표시하며 종료된 공공 행사는 탐색·지역 목록·사이트맵에서 제외합니다.
- 행사 카드, 모바일 목록, 행사 소개 모달의 북마크로 관심 행사를 저장하고 `/me/saved`에서 모아 봅니다. 한국과 대만 행사를 함께 보여 주며, 진행 중·예정과 종료된 행사를 나눕니다. 저장 후 비공개·숨김·삭제된 행사는 제목 없이 건수만 알리고 한 번에 정리할 수 있습니다. 관심 행사는 Google 로그인 회원만 저장할 수 있고 계정당 200개까지입니다. 로그인하지 않은 상태에서 북마크를 누르면 로그인 창이 열리고, `/me/saved`에는 로그인 안내가 나옵니다. 저장한 목록은 계정에 묶여 어느 기기에서나 보입니다.
- 행사 소개 모달의 공유 버튼은 Web Share API가 있으면 기기 공유 창을 열고, 없으면 링크를 복사합니다. 공유 링크는 `/korea?event=ID&lang=현재언어` 형식이라 미리보기도 공유한 사람의 언어로 나옵니다. 외부 SNS 스크립트는 쓰지 않습니다.
- 행사 신고는 방문자별 행사당 1회 접수할 수 있습니다. 신고는 `/admin` 관리자 화면에서 처리합니다([운영](#운영) 참고).
- 포스터를 올리면 AI가 이미지를 읽어 입력 칸을 미리 채웁니다. 서버의 `/api/extract-poster`가 Claude API를 호출합니다. 기본 모델은 `claude-haiku-5-5`이고 `ANTHROPIC_POSTER_MODEL`로 바꿀 수 있습니다. 요청 크기·출처 검사, 요청 제한, 15초 시간 제한을 적용합니다. 서버에 `ANTHROPIC_API_KEY`가 없으면 이 기능만 꺼지고 직접 입력으로 등록할 수 있습니다.

### 목록 보기

지도와 목록을 함께 또는 오가며 볼 수 있습니다. 모바일 목록 보기 주소는 `?view=list`이고, 새로고침하거나 링크를 공유해도 목록으로 열립니다.

- 모바일: 화면 아래 가운데의 `목록보기` 버튼을 누르거나 하단 시트를 끝까지 올리면 전체 화면 목록이 됩니다. `지도보기`를 누르거나 시트를 내리면 지도로 돌아옵니다. 지도는 그대로 남아 있어 다시 불러오지 않습니다.
- PC(701px 이상): 왼쪽 목록 패널(폭 340~400px), 오른쪽 지도입니다. 패널 위쪽에 나라 선택, 강조된 검색창, 작은 알약형 기간·정렬 필터, 총 개수가 있고 아래 목록(구분선으로 나뉜 행)만 따로 스크롤됩니다. 지역 칩은 지도 위쪽에 떠 있습니다. 패널과 지도 경계의 `‹` 버튼으로 패널을 접으면 지도가 전체 폭이 됩니다. 목록 행에 마우스를 올리면 지도 포스터가, 지도 포스터에 올리면 목록 행이 강조됩니다. 지도를 직접 끌거나 확대하면 아래 가운데에 `이 지역에서 검색`이 나타나고, 누르면 그 영역(`?bounds=`)으로 다시 찾습니다. 목록 위 `현재 지도 영역 ×`로 해제합니다. PC에서 `?view=list`로 들어와도 같은 화면입니다.
- 목록 항목은 포스터, 진행 상태(진행 중·오늘 종료·종료 임박·D-n·예정·종료·취소됨·연기됨), 지역, 제목, 일정, 장소, 관심 행사 저장, `지도에서 보기`로 구성됩니다. `지도에서 보기`는 (모바일은 지도로 바꾼 뒤) 그 행사 위치로 이동하고 표시합니다. 행사 소개 모달에도 같은 버튼이 있습니다.
- 정렬은 최신 등록순(기본), 일정 빠른 순, 종료 임박순입니다(`?sort=soon|ending`). 일정 순 정렬은 서버에서 하고 아직 끝나지 않은 행사만 보여 줍니다. 페이지는 24개씩입니다.
- `view`와 `sort`가 붙은 주소는 검색 색인에서 빼고(noindex) 기본 주소를 canonical로 가리킵니다. 사이트맵은 바뀌지 않습니다.
- 거리순 정렬은 아직 없습니다. 현재 `Permissions-Policy`가 위치 권한을 막고 있습니다.

### 지도 데이터

국가 지도에서 현재 국가명 옆 화살표를 누르면 한국·대만을 바로 선택할 수 있습니다. UI 언어는 유지하고 이전 국가의 지역·검색·페이지·행사 선택은 초기화합니다. 첫 화면으로 돌아갈 필요가 없습니다.

모바일 하단 포스터 목록은 기본으로 접혀 있습니다. ‘포스터 보기’를 누르면 124px 높이의 가로 썸네일 목록이 열리고, 다시 누르면 접힙니다. 포스터를 누르면 기존 행사 소개 모달이 열립니다. 지역 선택은 상단 바 바로 아래에서 항상 사용할 수 있습니다. PC는 왼쪽 목록 패널을 기본으로 표시합니다.

첫 화면과 한국·대만 탐색 화면은 같은 MapLibre GL JS 구형 지구를 사용합니다. 흰 배경에 파란 위경도 격자, 옅은 대륙 면과 윤곽, 행사 좌표를 표시합니다. 드래그로 회전하고 휠·핀치로 확대하며, 나라 선택 또는 첫 화면 지구본에서 한국·대만(그 안의 행사 묶음 원 포함)을 누르면 해당 국가로 확대한 뒤 국가 화면으로 이동합니다. PC에서는 두 나라에 마우스를 올리면 강조와 국가명이 표시됩니다. ◎ 버튼으로 지구 전체 보기로 돌아갑니다. 멀리서 본 지구본은 로컬 Natural Earth 지리 데이터로 그립니다. 줌 4~5 사이에서 지구본이 사라지고 [OpenFreeMap](https://openfreemap.org) 벡터 타일(무료, 키 없음, OpenMapTiles 스키마)의 밝은 상세 지도가 나타나 시·도부터 읍·면·동 이름, 도로, 강·바다, 공원, 건물(줌 14+)을 보여 줍니다. 지명은 화면 언어(한국어 `name:ko`, 영어 `name:en`, 번체 `name:zh-Hant`, 없으면 현지명)를 따르고, 한글·한자는 기기 글꼴로 그립니다. 첫 화면 지구본은 줌 3.5 이상으로 확대하기 전에는 타일을 요청하지 않습니다. 지도 서버에 닿지 못하거나 오류가 반복되면 상세 지도를 걷어내고 지구본 지도로 돌아가며, 행사 탐색은 그대로 동작합니다. 그 뒤 인터넷이 다시 연결되면 바로, 또는 30초·60초·120초가 지난 뒤 지도를 움직이면 상세 지도를 다시 붙입니다(연속 3번까지, 타일을 한 번 받으면 횟수 초기화). 출처(OpenFreeMap · OpenMapTiles · OpenStreetMap)는 오른쪽 아래에 표시하고 모바일에서는 ⓘ 아이콘으로 접습니다. 스타일은 `src/lib/map-style.ts`에 있습니다. 행사 등록 위치 선택 지도는 기존 래스터 타일(`/api/map-config`)을 그대로 씁니다. PC 목록 패널은 접을 수 있고, 모바일에서는 하단 시트로 표시됩니다.

지도 점은 크기를 유지한 주황색 원으로 표시합니다. 확대 단계 6부터 각 점 위에 48px 원형 포스터 한 장이 나타나고 7에서 선명해집니다. 묶인 점은 해당 묶음의 행사 한 장을 대표로 보여주며, 더 확대하면 개별 행사로 나뉩니다. 겹침을 피한 화면 내 최대 36개만 표시하며 `/api/map-posters`에서 해당 공개 행사의 이미지·소개 정보를 가져옵니다. 이미지 링크는 필요할 때만 발급하고 브라우저 메모리에 최대 4분간 보관합니다. 마우스·키보드 포커스로 행사명·장소·기간을 확인하고, 클릭·탭하면 소개 모달이 열립니다. 축소하면 포스터가 사라지고 주황색 점이 남습니다.

목록 썸네일·지도 포스터·포스터 카드는 공공 출처(문화포털 `www.culture.go.kr`, 파리 `cdn.paris.fr`, 대만 `*.gov.tw`·`*.taiwan.net.tw`) 이미지를 원본 대신 Next 이미지 변환(`/_next/image`)으로 줄인 WebP를 받습니다. 목록과 지도 포스터는 같은 192px 이미지를, 카드는 384px 이미지를 공유하고 품질은 70 하나만 허용합니다(Vercel 변환 횟수 절약, 캐시 31일). 출처 목록은 `src/lib/poster-hosts.ts` 한 곳에 있고 `next.config.ts`도 이를 씁니다. 사이트 안에 둔 대만 행사 사진 사본(`/assets/posters/`)도 같은 방식으로 줄입니다. 한국관광공사 이미지는 공공누리 제3유형(변경금지)이라 원본을 그대로 쓰고, 사용자 등록 포스터(Supabase 5분 링크)도 원본을 씁니다. 소개 모달은 항상 원본을 보여 줍니다. 줄인 이미지를 못 받으면 목록·카드는 원본으로 한 번 다시 시도하고, 지도 포스터도 원본으로 한 번 다시 시도한 뒤 실패하면 숨깁니다.

묶인 큰 점에 마우스를 올리면 행사 수와 최대 5개 행사명을 미리 보여줍니다. 큰 점이나 그 점의 원형 대표 포스터(또는 미리보기의 ‘전체 N개 보기’)를 누르면 자동 확대 대신 묶음 전체를 보여줍니다. PC 국가·지역 화면에서는 왼쪽 목록이 그 묶음의 행사로 바뀌고(‘선택한 위치의 행사 · 총 N개’, 24개씩 페이지, 주소는 바뀌지 않음), ‘전체 목록’으로 원래 목록에 돌아갑니다. 목록을 접어 두었으면 펼쳐지고, 묶음을 보는 동안 정렬은 잠기며, 지도 이동·확대나 ‘지도에서 보기’에는 유지되고 검색·분야·태그·기간·지역·영역을 바꾸면 해제됩니다. 점 하나는 지금처럼 소개 모달을 엽니다. 모바일은 하단 시트가 묶음 목록으로 바뀌고, 첫 화면의 지구에서는 포스터 목록 창이 열립니다(24개씩, 행사를 누르면 소개 모달, 닫으면 보던 페이지 유지).

확대 후 포스터 표시 간격 때문에 가려지는 주변 점도 대표 포스터의 묶음에 포함합니다. 여러 행사인 포스터는 주황색 개수 배지를 붙이고 호버 시 행사명들을 보여주며, 클릭하면 가려진 점의 행사까지 합친 목록을 엽니다. 실제 한 행사만 있는 포스터는 바로 소개를 엽니다.

등록 폼의 위치 선택 지도는 OpenStreetMap의 표준 타일 서버를 사용하며 출처가 표시됩니다. 공용 타일 서버는 제공이 보장되지 않고 사용량이 제한되므로, 공개 운영 전 적절한 타일 제공자를 선정하세요. 운영 환경에서는 `MAP_TILE_URL`(HTTPS의 `{z}/{x}/{y}` URL)과 `MAP_TILE_ATTRIBUTION`을 함께 설정해 위치 선택용 타일 제공자를 교체할 수 있습니다. 설정은 서버에서 런타임에 읽습니다. 제공자의 데이터·표시 조건과 이용 한도를 확인해야 합니다. 기존에 수집된 행사 좌표를 자동으로 보정하지는 않습니다.

### 주소 검색

Geoapify에서 발급받은 키를 서버 환경변수 `GEOAPIFY_API_KEY`에 설정하고 서버를 재시작합니다. `NEXT_PUBLIC_` 접두사는 사용하지 않습니다. 브라우저는 `/api/geocode`에 주소만 POST하고, 서버가 Geoapify에 조회하여 최대 5개의 후보 주소·좌표·지역·장소명을 돌려줍니다. 검색 버튼 또는 Enter로만 요청하며 로그인이나 가입은 필요하지 않습니다. 주소 범위·도시 수준의 결과를 고르면 대략적인 위치임을 알리고 확인용 지도를 펼칩니다. 검색 결과에 Geoapify·OpenStreetMap 출처를 표시합니다.

위치 입력은 주소 검색창, 작은 출처 링크, 접힌 확인용 지도를 하나의 영역으로 표시합니다. 중복 성공 안내는 생략하고 검색 실패·대략적 위치 등의 필요한 안내만 보여줍니다. 위치 확인 지도는 200~220px 크기로 격자·실시간 좌표 표시를 숨기며, 직접 좌표 입력은 추가로 펼칠 수 있습니다. 탐색용 지구의 격자·좌표 표시는 유지합니다.

등록·주소 검색은 대한민국(kr), 대만(tw), 프랑스(fr)를 지원합니다. 국가 목록은 `src/lib/countries.ts` 한 곳에 있고, 경로·분석·검증·사이트맵·지구본이 모두 이 목록을 따릅니다. 국가별 좌표 범위와 시간대(Asia/Seoul, Asia/Taipei, Europe/Paris)를 DB와 앱에서 함께 검증하며 국가를 바꾸면 이전 주소·좌표가 초기화됩니다. 서버는 제한된 메모리 캐시(최대 256개, 1시간)와 인스턴스 단위 요청 제한(IP별 분당 12회, 전체 분당 120회)을 적용합니다. 다중 인스턴스에서 전체 사용량을 일괄 제한하려면 배포 환경의 공통 제한 장치를 추가해야 합니다. API 키나 제공자의 원본 오류 응답은 클라이언트로 반환하지 않습니다.

## 데이터와 권한

`supabase/migrations/`의 마이그레이션을 현재 프로젝트에 적용했습니다.

| 테이블/뷰         | 용도                                        |
| ----------------- | ------------------------------------------- |
| `visitors`        | 개인정보 없는 방문자 식별자                 |
| `events`          | 행사 정보·작성자·초안/공개/숨김/삭제 상태   |
| `event_images`    | 행사당 포스터 한 장과 저장 경로             |
| `reports`         | 신고 사유와 처리 상태                       |
| `extraction_jobs` | 향후 서버 전용 AI 작업 상태·결과            |
| `saved_events`    | Google 회원별 관심 행사(본인만 조회·추가·삭제) |
| `event_regions`   | 공개 행사가 있는 지역 목록(RLS를 따르는 뷰) |

모든 테이블에 RLS를 적용했습니다. 공개 행사는 누구나 조회하고, 초안은 작성자만 조회·수정합니다. 숨김 상태는 작성자가 해제할 수 없습니다. 작성자 ID의 직접 변경은 금지되며, 검증된 Google 계정으로 비회원 행사를 연결하는 일회용 소유권 이전 함수만 예외입니다. AI 작업 생성/수정은 일반 방문자에게 허용하지 않습니다.

포스터는 비공개 `event-posters` 버킷의 `<방문자ID>/<행사ID>/<파일ID>.jpg` 경로에 저장합니다. 버킷 자체는 JPG·최대 10MB를 허용합니다. 앱에서 고르는 원본은 10MB까지이며 최대 1200px JPEG로 변환한 후 전송 파일을 3MB 이하로 제한합니다. 서버 액션 전체 상한은 4MB로 Vercel 배포 제한을 고려했고, 서버에서도 크기·타입·서명을 검사합니다. 업로드 소유권, 이미지 연결, 공개 시 실제 파일 존재를 DB/Storage에서도 확인합니다. 교체된 기존 이미지는 정리합니다.

공공데이터 행사는 방문자 작성자가 없습니다. TourAPI 행사는 한국관광공사 원본 이미지 URL과 이용유형이 있어야 저장됩니다. 원본 이미지는 변경하지 않고 표시하며 출처와 이용유형을 상세에 표시합니다. DB 제약과 RLS로 일반 사용자의 공공 출처 위조 및 공공 행사 수정을 제한합니다. 사용자 등록 행사에는 기존 포스터 공개 조건이 그대로 적용됩니다.

### 공공 축제 수집

한국관광공사 TourAPI를 사용하려면 공공데이터포털에서 [국문 관광정보 서비스_GW](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578) 활용 신청 후 인증키를 `.env.local`의 `TOUR_API_SERVICE_KEY`에 입력합니다. Encoding 또는 Decoding 키를 사용할 수 있습니다. 서버 전용 값이므로 `NEXT_PUBLIC_` 접두사를 붙이거나 저장소에 올리지 않습니다. 호스팅 시에도 서버 환경변수에 별도로 설정합니다.

`npm run import:tourapi`는 공식 API에서 지난 1년부터 시작한 행사 중 진행 중·예정인 항목을 조회하고, 제목·일정·좌표·원본 이미지 주소/이용유형 및 이미지 응답을 확인하는 읽기 전용 실행입니다. API 호출량을 사용합니다. 포스터/사진이 없거나 제공 이미지가 열리지 않으면 해당 행사는 수집 대상에서 제외합니다. AI 대체 이미지 기능은 아직 구현하지 않았습니다.

반영은 관리 환경에 `SUPABASE_IMPORT_PROJECT_REF`와 `SUPABASE_IMPORT_SERVICE_KEY`를 일시적인 환경변수로 지정한 뒤 `npm run import:tourapi -- --apply`로 실행합니다. 프로젝트 URL과 프로젝트 ID가 일치해야 합니다. 서비스 키는 저장소·브라우저·공개 환경변수에 넣지 마세요. 재실행은 TourAPI 콘텐츠 ID를 기준으로 갱신하며 숨김/삭제 상태를 복구하지 않습니다. 원본에서 사라진 행사를 자동 삭제하지 않습니다. 이미지 URL은 한국관광공사 서버를 가리키므로 원본 서비스에 따라 나중에 변경되거나 사용할 수 없을 수 있습니다.

기존 전국문화축제표준데이터 64건은 TourAPI 이미지와 공개 조회 검증 후 소프트 삭제했습니다. `import:festivals`는 예전 데이터 확인 용도로만 남기고 쓰기 기능을 막았습니다. 사용자 등록 행사는 그대로 유지합니다.

GitHub Actions의 `TourAPI Sync` 워크플로가 매주 월요일 01:00(KST)에 `--apply`로 수집 결과를 반영합니다. 저장소 Secrets에 `TOUR_API_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_IMPORT_SERVICE_KEY`, `SUPABASE_IMPORT_PROJECT_REF`가 모두 있어야 합니다. 하나라도 없으면 실행이 실패합니다. Actions 탭에서 수동으로 실행하면 기본은 dry-run이고, `apply`를 체크해야 DB에 씁니다.

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
public/assets/            Natural Earth 세계/한국/대만/프랑스(본토) 지도 데이터
scripts/                  단위·실서버·실DB 검증
docs/WORK_LOG.md           프로젝트 작업 기록
```

## 운영

`/admin`에서는 처리 대기 중인 신고와 최근 행사 50개를 보고, 신고 처리와 행사 삭제를 할 수 있습니다. 서버 환경변수 `ADMIN_USER_ID`에 지정한 Supabase 계정으로 로그인해야 하며, 그 계정에 `app_metadata.role = "admin"`도 있어야 열립니다. 조건이 맞지 않으면 404를 반환합니다. 관리자 암호 로그인은 없습니다. Supabase Dashboard의 `reports`와 `events.publication_status`를 직접 고쳐도 됩니다. 일반 방문자의 DB 권한과 RLS는 그대로입니다.

Vercel Cron이 매주 일요일 03:00(UTC)에 `/api/cron/analytics`를 호출해 90일이 지난 원시 분석 기록을 지웁니다. 서버에 `CRON_SECRET`이 없으면 이 요청은 401로 거부됩니다.

방문자를 읽기 전용 탐색 때 미리 생성하지 않습니다. Supabase의 익명 세션 생성 제한을 유지하며, 실제 브라우저 요청으로 생성해 IP별 제한이 적용되도록 합니다. 사용하지 않는 익명 방문자 정리 시 게시물 작성자를 일괄 삭제하지 않도록 주의해야 합니다. 방문자 쿠키를 영구적인 계정 복구 수단으로 취급하지 않습니다.

사용자 Codex 설정의 `supabase_festiva`는 공식 로컬 stdio MCP 0.15.0으로 이 프로젝트에만 연결됩니다. 실행 파일과 관리 인증정보는 저장소 밖 사용자 `.codex`에 보관합니다. 설정 변경 후에는 새 세션/앱 재시작이 필요합니다.

운영 사이트는 Vercel 프로젝트 `world-map-imtc`(https://world-map-imtc.vercel.app)이며, `main`에 푸시하면 배포됩니다. 별도 도메인을 연결하면 `NEXT_PUBLIC_SITE_URL`을 그 주소로 바꾼 뒤 다시 배포합니다. `.openai/hosting.json`에는 기존 Sites 프로젝트 ID만 보존합니다. 지리 데이터는 Natural Earth 110m 세계/50m 한국·대만 데이터와 OpenFreeMap 벡터 타일·라틴 글리프(`tiles.openfreemap.org`, CSP `connect-src`에 허용)입니다. 그 밖의 외부 폰트나 런타임 CDN은 사용하지 않습니다.

## Categories and tags

Every event has one `category` (`festival`, `exhibition`, `performance`, `other`; default `other`) and up to 12 `tags` (lowercase keys such as `concert`, `theater`, `kids`, `photo`; each checked by `valid_event_tags`). Chips “전체 · 축제 · 전시 · 공연 · 기타” sit under the search box on desktop and in the mobile sheet header; one category at a time, tapping the active chip clears it. The filter is `?category=` (kept by every region, date, search, sort, page and map-area link; invalid values mean all), applies to the list and the map markers, and is noindex like the date filter. List rows show the category (except 기타). Sources map as follows: TourAPI, Taiwan and national festivals → festival; culture info 행사/축제 → festival, 전시 → exhibition, concerts/plays/musicals/dance/gugak → performance (tag per realm); Paris Festival → festival, exhibitions → exhibition, food/fairs/flea markets → other (tags from the listing). People choose a category when they register an event (default 기타); a page loaded before categories existed never overwrites the saved one.

With a category chosen, a second row of tag chips narrows it (`?category=performance&tag=musical`), e.g. Korea performances → 콘서트 · 연극 · 뮤지컬 · 무용 · 국악, Paris exhibitions → 현대미술 · 사진 · 회화…. One tag at a time; tapping the active tag clears it, changing the category drops it, region/search/date/area links keep it, and the mobile settings reset keeps it. Chips are counted on the server from the same filters minus the tag (so the other tags stay while one is active): only tags with a label in `src/lib/event-tags.ts`, on at least 2 events but not on all of them, most used first, at most 8; fewer than 2 chips hides the row (Korea exhibitions/festivals, Taiwan). A tag without a valid category or an unknown tag is ignored. Tag URLs are noindex and the canonical keeps the tag, like the date filter. On mobile the lowest sheet height grows from 144px to 180px while the tag row shows.

## Korean culture data

Besides the TourAPI festivals, `/korea` lists performances, exhibitions and festivals from the Korea Culture Information Service “한눈에보는문화정보” (data.go.kr 15138937, no usage restriction; same data.go.kr key as TourAPI, encoded exactly once). `node scripts/import-cultureinfo.mjs` (dry run) keeps events with coordinates and an image: festivals and exhibitions up to 180 days, concerts/plays/musicals/dance/gugak up to 90 days (open runs, education and kids programs are left out) — about 790 events. Province spellings are mapped onto the names the TourAPI rows use (including 전남광주통합특별시), festivals that match an active TourAPI row (dates ±7 days, ≤2 km, similar title) are skipped, and titles keep their `<…>` parts. Calls are spaced 250 ms apart for the gateway's per-second limit. `--sql FILE` / `--apply` behave like the Paris import (hide what left, never hide failed checks, refuse below 70% or 30 events); `.github/workflows/cultureinfo-sync.yml` runs it every Monday 02:00 KST. The modal labels the source “문화포털 한눈에보는문화정보 · 이용허락범위 제한 없음” and hides the description block when a listing has none. Images come from `https://www.culture.go.kr` (CSP `img-src`).

## Country requests

The home globe's country select ends with “+ 다른 나라 요청하기…”, which opens a dialog listing every ISO 3166-1 country we do not cover yet (names from `Intl.DisplayNames` in the UI language, searchable by local name, English name or ISO code). No login: `POST /api/country-requests` checks same origin, blocks bot user agents, validates `{ countryCode }`, throttles 10 requests per minute per keyed IP hash (memory only) and records one vote per visitor and country through `record_country_request`: a keyed hash of its own `festiva-country-request` cookie (not linkable to analytics), the ISO code, and a keyed hash of the network and UTC day that caps new requests at 20 per network per day. The IP itself is never stored. Local and preview builds answer `recorded: false` without writing, because they share the production database. `/admin` ranks requested countries by all-time or last-30-day count (`country_request_summary`, admin only). Counts are not shown to visitors.

## France (Paris) data

`/france` shows festivals, exhibitions and fairs from the City of Paris open data “Que faire à Paris” (https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/, ODbL, no key). Titles and descriptions stay in the original French (`lang="fr"`); the modal shows the photographer credit (`source_image_credit`) under the poster and the source with an ODbL link, and the list ends with an ODbL notice. Region chips are the Paris arrondissements (`paris-01`…`paris-20`) plus `grand-paris`. Images are hotlinked from `https://cdn.paris.fr` (CSP `img-src`).

`node scripts/import-paris.mjs` is a dry run: it keeps events with coordinates, an image and an end date, tagged Festival (≤180 days), exhibition (≤120 days) or fair/market (≤30 days), and drops workshops, talks and service listings (about 400 of ~3,000 upcoming records). `--sql FILE` writes an upsert for the Management API; `--apply` writes with `SUPABASE_IMPORT_SERVICE_KEY`, verifies public visibility and hides (`hidden`) upcoming Paris events that left the listing; a hidden event that reappears is published again, while admin deletions stay deleted. Events whose image check failed are never hidden. Fewer than 20 usable events, or fewer than 70% of the currently published ones, stops the run without writing. Dates are the UTC calendar days the listing uses (ends are stored as 23:59Z). `.github/workflows/paris-sync.yml` applies it every Monday 02:00 UTC (needs the same `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_IMPORT_*` secrets as the TourAPI sync).

## Taiwan seed data

`/taiwan` uses country-scoped events/regions and the same globe and introduction modals. The home globe displays both countries. `data/taiwan-events.json` contains six curated English introductions based on the Taiwan Tourism Administration activity open dataset (https://data.gov.tw/en/datasets/7778), with original official images, source attribution, reference date and OGDL-1.0 licensing. These are representative images and may be photos rather than edition-specific posters. An official image too large for the image optimizer can be replaced by a reduced JPEG copy (OGDL-1.0 allows modification): put it at `public/assets/posters/<sourceId>.jpg` (under 1MB) and set `localPoster` in the JSON; the import then stores that path instead of the official URL, which stays in `poster` for reference. Pingtung Luoshanfeng Art Festival uses one (official 8000x6000, 14.7MB → 1200x900, 119KB).

Run `node scripts/import-taiwan.mjs` to validate current records and check all image URLs. `--sql OUTPUT_FILE` writes an upsert for review/application through the existing project database MCP; it does not execute SQL or require a service key. Repeat imports preserve hidden/deleted publication states and do not remove unrelated records. Refresh the curated source records when their dates expire; no automatic scheduler has been added.

## UI languages

The UI supports Korean (default), English and Traditional Chinese. The language control is available on the main screen and inside registration/detail/group dialogs. Selection is stored in the `festiva-language` cookie for one year; server content and the HTML language use the same preference. Switching languages preserves the current map camera, filters and unsaved registration fields. Language selection updates `?lang=ko|en|zh-TW` while retaining event/filter/page parameters. Explicit URL language overrides the cookie, and canonical/hreflang links expose each version to crawlers. Event content remains original; UI translation does not translate submitted titles, descriptions or addresses.

Add UI copy in `src/lib/i18n/messages.ts` as Korean/English/Traditional Chinese triples. Use `useTranslations()` in client components and `getTranslations()` on the server. Unit tests validate dictionary keys, values and interpolation placeholders. No external translation service is required.

## First-party traffic and event analytics

공개 탐색 화면에 오늘 방문자·누적 페이지 조회·누적 행사 조회를 작은 글씨로 표시합니다. PC 국가 지도에서는 좌상단 국가명에 이어 표시하고, 모바일에서는 검색·설정 패널을 열었을 때 표시합니다. 모바일 지도 상단은 뒤로가기·브랜드·검색·설정·행사 추가만 남기고, 검색·계정·언어·포스터 접기는 아이콘을 눌러 여는 상단 패널에 모았습니다. 지역 선택은 패널 밖, 상단 바 바로 아래에서 가로 스크롤로 항상 이용할 수 있습니다. 패널은 기존 상단 줄을 덮으며 닫기·바깥 클릭·Esc를 지원하고 검색 입력은 닫았다 열어도 유지합니다. 좌하단 좌표와 통계는 겹치지 않습니다. 관리자 페이지·암호 입력은 없으며 누구나 세 집계를 볼 수 있습니다. 한국 시간 기준이고 방문자는 브라우저 추정치입니다. 동시 접속자 수가 아닙니다. 집계가 표시되는 동안 약 1분 간격으로 갱신하며 조회 실패 시 숫자를 만들어 표시하지 않습니다.

Public route navigation (`/`, `/korea`, `/taiwan`, `/france`, normalized `/regions`) records a page view; language changes, prefetches and filter-only URL updates do not. An event view records only after opening the introduction modal; the database counts each public event once per session. Tracking cookies are HttpOnly: a one-year browser ID and a session ID expiring after thirty minutes without a collected hit. Requests are serialized to avoid assigning multiple identities before the initial cookies arrive. Localhost, Vercel previews, common bot agents, hidden pages and DNT/GPC opt-outs are excluded. Set `ANALYTICS_INCLUDE_LOCAL=true` only when explicitly testing ingestion, then remove it.

Applied `202611100004_analytics.sql` and `202611100006_public_traffic.sql`. Raw analytics/settings tables remain inaccessible to clients. `/api/traffic` returns only three validated numeric totals through a key-protected RPC, with server/CDN caching; the former detailed dashboard RPC was removed. Only the SHA-256 hash of `ANALYTICS_WRITE_KEY` is stored in `analytics_settings`. Keep this server-only key in the hosting environment; rotating it requires updating the database hash too. No administrator password, service-role key or Google account is needed for these public counters.

No raw IP, full URL/query, user agent, event content or Supabase visitor/account ID is stored. Browser/session identities are HMAC hashes, and referrers contain hostnames only; none are returned by the public counters. Ingestion validates bounded allowlisted payloads, requires the same origin, and applies per-instance throttling. This is not a fraud-proof advertising billing system. A weekly Vercel Cron job (`/api/cron/analytics`, Sunday 03:00 UTC) deletes raw hits older than 90 days.

## Search and social sharing

Public home/country/region pages and event modal URLs have localized titles/descriptions, self-consistent canonical URLs, reciprocal language alternates, Open Graph and Twitter metadata. Paginated listings retain their page number in the canonical; internal search/empty results/unknown regions and past events are noindex. Region filters are crawlable links. Direct `/korea?event=ID&lang=ko` or `/taiwan?event=ID&lang=en` requests focus on one event and server-render an open introduction dialog with the event as the main heading; no standalone detail page was restored. Closing returns to discovery. JavaScript-enhanced interactions retain the existing modal design.

JSON-LD describes the website, collection lists and breadcrumbs. A direct event URL emits Event data only when dates and a real address are available. No prices, free entry, organizers or ticket availability are invented. Structured data makes the content understandable; rich-result display remains a search-engine decision. `/images/events/ID` resolves a current public poster through a no-store redirect, keeping short-lived Supabase signatures out of indexed metadata. `/og` provides the default 1200?630 social image, with an SVG brand favicon.

`sitemap.xml` includes current public event URLs, real update dates and language alternates; private/hidden/deleted/expired records are excluded. Robots excludes private/admin/API paths. Local builds and Vercel previews are noindex; previews also receive an X-Robots-Tag. Set `NEXT_PUBLIC_SITE_URL` to the final public HTTPS origin before building/deploying. Vercel's project production domain is a fallback; arbitrary request/preview hosts are never used as canonical origins. Production is served at https://world-map-imtc.vercel.app.

After deployment, register the actual domain with Google Search Console and Naver Search Advisor, configure optional `GOOGLE_SITE_VERIFICATION` and `NAVER_SITE_VERIFICATION` token values, redeploy, and submit `/sitemap.xml`. These accounts/domain ownership have not been registered by the agent. Verify a country URL and an event URL with URL Inspection/Rich Results Test after the live site is reachable.
