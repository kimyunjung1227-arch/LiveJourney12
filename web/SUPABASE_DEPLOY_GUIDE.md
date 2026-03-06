## Supabase + LiveJourney 배포 가이드

이 문서는 **LiveJourney 웹앱을 Supabase 백엔드와 함께 배포하기 위한 실전 가이드**입니다.  
현재 구조를 크게 흔들지 않고, 단계별로 Supabase를 도입하는 흐름에 맞춰 정리했습니다.

---

## 1. Supabase 프로젝트 생성

1. `https://supabase.com` 회원가입 후 로그인.
2. 대시보드에서 **New project** 클릭.
3. 아래 값 입력:
   - **Project name**: 예) `livejourney`
   - **Database password**: 강한 비밀번호 (꼭 보관해두기)
   - Region 선택 → `Create new project`.
4. 프로젝트 생성 후, 좌측 메뉴에서 **Settings → API** 로 이동:
   - `Project URL`
   - `anon public` 키  
   이 두 값을 이후 `.env`에서 사용합니다.

---

## 2. 데이터베이스 스키마 설정 (예시)

Supabase Studio → **SQL Editor** 에 다음 SQL을 실행합니다.

```sql
-- 1) 사용자 기본 정보
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2) 게시물 정보
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  content text,
  images jsonb default '[]'::jsonb,
  videos jsonb default '[]'::jsonb,
  location text,
  region text,
  created_at timestamptz default now()
);

-- 3) 팔로우 관계
create table if not exists public.follows (
  follower_id uuid references public.users (id) on delete cascade,
  following_id uuid references public.users (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);
```

> ⚠️ 실제 운영 시에는 현재 백엔드/프론트에서 사용하는 필드를 기준으로 컬럼을 추가 확장하면 됩니다.  
> 위 스키마는 **최소한의 posts/users/follows 구조 예시**입니다.

---

## 3. 프론트엔드에서 Supabase 연결하기

### 3.1 패키지 설치

```bash
cd web
npm install @supabase/supabase-js
```

### 3.2 환경 변수 설정

`web` 폴더 아래에 `.env` (또는 `.env.local`) 파일을 생성하고 다음을 추가합니다.

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

### 3.3 Supabase 클라이언트 유틸 만들기

`web/src/utils/supabaseClient.js` 파일을 새로 만듭니다.

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

이제 어떤 페이지에서도 `import { supabase } from '../utils/supabaseClient';` 로 Supabase 인스턴스를 사용할 수 있습니다.

### 3.4 사진 저장용 Storage 버킷 (필수)

업로드한 **사진/동영상**을 Supabase에 저장하려면 Storage 버킷을 만들어야 합니다.

1. Supabase 대시보드 → **Storage** → **New bucket**
2. 버킷 이름: **`post-images`** (코드에서 사용하는 이름과 동일해야 함)
3. **Public bucket** 체크 (업로드된 이미지 URL로 접근 가능하도록)
4. **Create bucket** 후, 버킷 설정에서 **Policies** 추가:
   - **Allow public read**: `SELECT` 정책으로 `true` (또는 공개 읽기)
   - **Allow upload**: `INSERT` 정책으로 인증된 사용자 또는 anon 허용 (테스트 시 anon 허용 가능)

이렇게 하면 앱에서 업로드한 사진이 Supabase Storage에 저장되고, 게시물의 `images` 배열에 https URL이 들어가 새로고침 후에도 보입니다.

---

## 4. 예시: Supabase에서 게시물 불러오기

아직 모든 화면을 한 번에 바꾸지 말고, **특정 화면부터 점진적으로 Supabase로 옮기는 것**을 권장합니다.  
아래는 기본적인 게시물 목록 조회 패턴입니다.

```javascript
import { supabase } from '../utils/supabaseClient';

export async function fetchPostsFromSupabase(limit = 50) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase posts error', error);
    return [];
  }

  return data ?? [];
}
```

기존에 `getCombinedPosts(localPosts)` 를 쓰던 곳에서:

- **1단계**: `localPosts`(로컬 업로드 데이터)를 유지하면서, Supabase에서 불러온 배열을 합쳐서 사용.
- **2단계**: 충분히 안정화되면, 로컬 저장/목업 데이터 경로를 점차 제거하고 Supabase만 사용.

---

## 5. Supabase Auth 연동 방향 (선택)

현재 프로젝트는 자체 Auth/백엔드가 있으므로, 바로 Supabase Auth로 갈아타지 않아도 됩니다.  
향후 전환 시를 위해 기본 흐름만 적어둡니다.

1. Supabase Studio → **Authentication → Providers** 에서 Google/Kakao 등 OAuth Provider 활성화.
2. 프론트에서:

```javascript
import { supabase } from '../utils/supabaseClient';

const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // kakao 지원 시 'kakao'
  options: {
    redirectTo: 'https://배포된도메인/auth/callback',
  },
});
```

3. `AuthCallbackScreen` 에서 `supabase.auth.getSession()` or `onAuthStateChange` 로 로그인 결과를 받고,  
   `AuthContext` 의 `user` 상태와 연결하는 식으로 마이그레이션합니다.

이 작업은 현재 백엔드 구조에 영향을 크게 주므로, **배포 이후 별도 단계에서 진행하는 것**을 추천합니다.

---

## 6. 프론트 웹앱 배포 (Vercel 기준)

Supabase는 **DB/백엔드**, React 앱은 **정적 호스팅(Vercel/Netlify 등)** 에 배포하는 구성이 일반적입니다.  
아래는 Vercel 기준 예시입니다.

### 6.1 GitHub에 코드 올리기

1. 로컬에서 변경 사항 커밋:

```bash
git add .
git commit -m "Prepare Supabase deployment"
git push origin master   # 또는 사용하는 브랜치 이름
```

2. GitHub 리포지터리가 준비되면 Vercel에서 연결합니다.

### 6.2 Vercel 프로젝트 생성

1. `https://vercel.com` → `New Project`.
2. GitHub에서 `livejourney` 리포지터리 선택.
3. 설정:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables** 섹션에 다음을 모두 추가:
   - `VITE_SUPABASE_URL` — Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY` — Supabase anon public 키
   - `VITE_KMA_API_KEY` — 기상청 API 키 (날씨 기능용, [공공데이터포털](https://www.data.go.kr)에서 발급)
   - `VITE_KAKAO_MAP_API_KEY` — 카카오맵 JavaScript 키 (지도 기능용)
5. Deploy 클릭 → 빌드 완료 후 제공된 도메인으로 접속.

> ⚠️ 빌드가 로컬에서 실패한다면, Node 버전 업데이트나 의존성 정리를 먼저 수행한 뒤 다시 시도하세요.

---

## 7. 단계별 적용 전략 요약

1. **Supabase 프로젝트 + DB 스키마 생성**  
   `users`, `posts`, `follows` 등 최소 테이블 구성.

2. **프론트 환경변수 & supabaseClient 설정**  
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → `supabaseClient.js`.

3. **목업 데이터 제거**  
   현재처럼 `mockData.js` 에서 실제/로컬 데이터만 사용하도록 유지.

4. **화면별로 Supabase로 전환**  
   - 예: RealtimeFeed, MainScreen, PostDetail 부터 `fetchPostsFromSupabase` 사용.

5. **Vercel에 웹앱 배포 + Supabase 연결 확인**  
   브라우저 네트워크 탭에서 Supabase API 호출이 정상 동작하는지 확인.

6. (선택) **Auth/백엔드도 Supabase로 점진적 이전**  
   기존 Auth 로직을 Supabase Auth로 교체하고, Express API를 Supabase Edge Functions로 이관.

---

이 가이드를 따라가면:

- Supabase를 **데이터소스/백엔드 플랫폼**으로 사용하면서,
- 기존 LiveJourney 프론트 구조는 크게 바꾸지 않고,
- 점진적으로 실서비스용 아키텍처로 전환할 수 있습니다.

