# Google 가입·로그인 설정 방법

앱 코드는 연결되어 있지만, Google에서 발급받은 클라이언트 ID와 비밀번호를 Supabase에 등록해야 실제 로그인이 가능합니다. 비회원 행사 등록도 계속 사용할 수 있습니다.

## 1. Google 프로젝트 만들기

1. [Google 인증 플랫폼](https://console.cloud.google.com/auth/overview)에 접속합니다.
2. 상단에서 프로젝트를 선택합니다. 없다면 **새 프로젝트**를 만들고 이름을 `festiva`로 정합니다.
3. 처음 설정하는 화면이라면 **시작하기(Get started)**를 누릅니다.
4. 앱 이름은 `festiva`, 지원 이메일과 개발자 연락처는 본인이 확인할 수 있는 이메일로 입력합니다.
5. **대상(Audience)**은 **외부(External)**로 선택하고 저장합니다. 개인 Google 계정을 포함한 일반 사용자에게 공개할 서비스입니다.

## 2. 로그인용 클라이언트 만들기

1. 왼쪽 **클라이언트(Clients)** → **클라이언트 만들기(Create client)**를 누릅니다.
2. 애플리케이션 유형은 **웹 애플리케이션(Web application)**을 선택합니다.
3. 이름은 `festiva web`으로 입력합니다.
4. **승인된 리디렉션 URI(Authorized redirect URIs)**에 아래 주소를 그대로 추가합니다.

   ```text
   https://mgkocrlncpomhdaoxxqh.supabase.co/auth/v1/callback
   ```

   이 항목에는 localhost 주소가 아니라 **위 Supabase 주소**를 넣습니다. 현재 서버 OAuth 방식에서는 Google One Tap 설정은 필요하지 않습니다.

5. 만들기를 누르고 **클라이언트 ID(Client ID)**와 **클라이언트 보안 비밀번호(Client secret)**를 복사합니다. 비밀번호는 발급 직후 안전하게 보관합니다.

## 3. 프로젝트에 키 넣기

`festiva/.env.local`에서 다음 항목을 찾아 발급받은 값으로 바꿉니다. 이 파일은 Git에 올라가지 않도록 설정되어 있습니다.

```dotenv
GOOGLE_CLIENT_ID=발급받은ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=발급받은비밀번호
GOOGLE_AUTH_ENABLED=false
```

`GOOGLE_AUTH_ENABLED`는 Supabase 설정이 끝날 때까지 `false`로 둡니다. 비밀번호는 채팅에 보내지 마세요.

여기까지 입력한 뒤 **“키 넣었어”**라고 알려주면, 연결된 관리 도구로 Supabase 설정과 로그인 활성화를 이어서 진행할 수 있습니다.

## 4. 테스트 계정 추가하기

Google 인증 플랫폼의 **대상(Audience)**에서 게시 상태가 **테스트(Testing)**라면 **테스트 사용자(Test users)**에 로그인해 볼 Google 이메일을 추가합니다.

전체 공개 전에는 외부 사용자가 가입할 수 있도록 게시 상태와 Google의 공개 요건을 확인합니다. 도메인·홈페이지·개인정보처리방침 등 공개용 정보도 준비합니다. 앱에서 요청하는 권한은 기본 로그인 정보인 `openid email profile`입니다.

## 5. Supabase를 직접 설정하는 방법

키 입력까지만 하고 연결을 맡겨도 됩니다. 직접 설정하려면 다음 순서대로 진행합니다.

1. [Supabase 프로젝트](https://supabase.com/dashboard/project/mgkocrlncpomhdaoxxqh/auth/providers)의 **Authentication → Sign In / Providers → Google**을 엽니다.
2. Google 제공자를 활성화하고 클라이언트 ID와 비밀번호를 입력한 뒤 저장합니다.
3. 인증 설정에서 **수동 계정 연결(Manual identity linking)**을 활성화합니다. 비회원 행사를 Google 계정에 연결할 때 필요합니다.
4. **URL Configuration**의 Site URL을 현재 앱 주소로 설정합니다. 로컬에서는 `http://127.0.0.1:3000`을 사용할 수 있습니다.
5. Redirect URLs에 다음 주소를 허용합니다.

   ```text
   http://localhost:3000/auth/callback
   http://127.0.0.1:3000/auth/callback
   ```

6. `.env.local`의 `GOOGLE_AUTH_ENABLED=true`로 바꾸고 개발 서버를 재시작합니다.

### 자동 설정 스크립트

프로젝트 폴더에서 다음 명령은 대상과 콜백 주소만 확인하며 설정을 변경하지 않습니다.

```powershell
node scripts/setup-google-auth.mjs
```

실제 반영은 다음 명령을 사용합니다. 별도 관리용 `SUPABASE_ACCESS_TOKEN` 환경변수가 필요합니다. 또는 `--credentials <파일경로>`로 `projectRef`와 `accessToken`이 담긴 비공개 JSON 파일을 지정할 수 있습니다. 관리 토큰이나 파일은 저장소에 올리지 않습니다.

```powershell
node scripts/setup-google-auth.mjs --apply
```

스크립트는 프로젝트 일치를 확인하고 기존 허용 주소를 유지하면서 Google 제공자와 수동 계정 연결을 설정합니다. 성공하면 로컬 `GOOGLE_AUTH_ENABLED=true`도 반영합니다. 앱 실행 자체에는 관리 토큰이 필요하지 않습니다.

## 6. 배포할 때 추가할 설정

- 호스팅 환경의 `NEXT_PUBLIC_SITE_URL`과 Supabase Site URL을 실제 서비스 주소로 설정합니다.
- Supabase Redirect URLs에 `https://실제도메인/auth/callback`을 추가합니다.
- 호스팅 환경에 `GOOGLE_AUTH_ENABLED=true`를 설정하고 다시 배포합니다.
- Google에 등록한 Supabase 콜백 주소는 같은 Supabase 프로젝트를 사용하는 동안 그대로 유지합니다.
- Google 비밀번호는 Supabase에 등록한 후 앱 실행 환경에는 필요하지 않습니다. 자동 설정 스크립트 실행 때만 로컬 입력값으로 사용합니다.

## 확인할 항목

처음 가입·재로그인·로그아웃·취소, 비회원 행사와 포스터 연결, 이미 가입한 계정으로의 행사 이전, 다른 브라우저에서 같은 계정으로 행사 관리가 되는지 확인합니다. 이전 localStorage 초안은 자동 업로드하지 않습니다. 실제 Google 인증 과정은 유효한 클라이언트 키를 설정한 뒤 확인해야 합니다.

공식 안내: [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [비회원 계정 연결](https://supabase.com/docs/guides/auth/auth-anonymous), [Google 웹 OAuth 안내](https://developers.google.com/identity/protocols/oauth2/web-server?hl=ko).
