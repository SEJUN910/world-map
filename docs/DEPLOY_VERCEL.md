# GitHub → Vercel 배포

현재 앱은 Next.js이며 프로젝트 루트의 `vercel.json`과 `package.json`으로 빌드합니다. Node.js는 로컬 검증 환경과 같은 24.x를 사용합니다. 기존 Supabase DB와 Storage를 그대로 연결하며, 배포할 때 DB를 초기화하지 않습니다.

## 진행 상태

아직 GitHub 원격 저장소와 Vercel 프로젝트를 연결하지 않았습니다. 연결된 계정이 확인되면 새 비공개 `festiva` 저장소를 기본으로 생성하고 `main`을 배포 브랜치로 사용합니다. 이름이 이미 있거나 조직 계정을 사용해야 한다면 실제 대상을 먼저 확인합니다.

## 저장소와 프로젝트

1. GitHub 계정을 연결하고 저장소에 현재 Next.js 소스를 올립니다. `.env.local`, `.next`, `node_modules`, `.vercel` 등은 올리지 않습니다.
2. [Vercel 새 프로젝트](https://vercel.com/new)에서 GitHub 저장소를 가져옵니다. Vercel GitHub 앱에 이 저장소 접근 권한이 있어야 합니다.
3. 프레임워크는 **Next.js**, 루트는 `./`, 설치 명령은 `npm ci`, 빌드는 `npm run build`입니다. 출력 디렉터리는 Next.js 기본값으로 두며 `dist`로 지정하지 않습니다.
4. 아래 환경변수를 입력하고 배포합니다. 값은 채팅이나 GitHub 파일에 넣지 않습니다.
5. 이후 `main`에 푸시하면 연결된 Vercel 프로젝트가 자동으로 프로덕션 배포합니다. 다른 브랜치는 미리보기 배포 대상입니다.

## 배포 환경변수

| 이름 | 설정 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`의 기존 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 기존 공개용 키 |
| `GEOAPIFY_API_KEY` | 기존 주소 검색 키, 서버 전용 |
| `ANALYTICS_WRITE_KEY` | 기존 통계 키를 그대로 사용, 서버 전용 |
| `GOOGLE_AUTH_ENABLED` | `true` — Supabase Google 설정 완료 상태 |
| `NEXT_PUBLIC_SITE_URL` | 실제 프로덕션 주소. localhost를 복사하지 않음 |
| `GOOGLE_SITE_VERIFICATION` / `NAVER_SITE_VERIFICATION` | 검색 서비스 확인 토큰이 있을 때만 |

첫 배포에서 주소를 아직 모르면 `NEXT_PUBLIC_SITE_URL`은 생략하고 Vercel이 제공하는 프로덕션 도메인을 사용합니다. 주소 확인 후 정확한 HTTPS 원점을 설정하고 재배포합니다. 미리보기 주소를 프로덕션 기준 주소로 쓰지 않습니다.

Google 클라이언트 비밀번호는 이미 Supabase에 있으므로 Vercel 앱 환경에는 필요하지 않습니다. TourAPI 수집은 로컬 스크립트로 운영하므로 해당 키도 일반 웹앱 배포에는 필요하지 않습니다. Supabase 관리 토큰이나 service-role 키도 웹앱에 넣지 않습니다. `ANALYTICS_INCLUDE_LOCAL`과 로컬 검증용 `FESTIVA_BUILD_DIR`은 배포 환경에 넣지 않습니다.

## 배포 후 Google 로그인

Supabase Authentication → URL Configuration에서 Site URL을 실제 프로덕션 주소로 설정하고 Redirect URLs에 다음 형식의 정확한 콜백을 추가합니다. 기존 로컬 허용 주소는 유지할 수 있습니다.

```text
https://실제프로덕션도메인/auth/callback
```

Google Cloud에 등록한 Supabase 콜백 주소는 그대로입니다.

```text
https://mgkocrlncpomhdaoxxqh.supabase.co/auth/v1/callback
```

Google 앱이 테스트 상태라면 등록된 테스트 계정만 로그인할 수 있습니다. 공개 운영 전에는 Google의 앱 게시 상태와 필요한 공개 정보를 확인합니다. 미리보기 주소 전체를 로그인 콜백으로 광범위하게 허용하지 않습니다.

## 확인

- 홈·한국·대만 지도와 포스터·행사 소개 모달
- 주소 검색, Google 로그인과 실제 프로덕션 주소 복귀
- 행사 등록 및 비공개·공개 저장, 포스터 교체
- `/api/traffic`의 숫자 집계, 프로덕션 트래픽 수집
- `/robots.txt`, `/sitemap.xml`과 공유 이미지의 프로덕션 주소

포스터 원본은 10MB까지 선택할 수 있고, 브라우저에서 최대 1200px JPEG로 변환합니다. 전송 파일은 3MB, Next.js 액션 전체는 4MB 상한을 사용해 Vercel Functions의 4.5MB 요청 제한 내 여유를 둡니다. DB에 API 키를 새로 만들거나 실제 결제를 활성화하는 작업은 포함하지 않습니다.

공식 문서: [Vercel GitHub 연동](https://vercel.com/docs/git/vercel-for-github), [환경변수](https://vercel.com/docs/environment-variables), [함수 요청 크기 제한](https://vercel.com/docs/functions/limitations).
