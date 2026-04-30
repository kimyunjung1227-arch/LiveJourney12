# Edge Function: analyze-tags (Google Gemini)

이미지를 **Google Gemini**(gemini-1.5-flash)로 분석해 **해시태그**와 **카테고리**(꽃·개화, 맛집, 풍경, 관광지, 웨이팅, 일반)를 자동 분류합니다.  
**API 키는 Supabase Secrets에만 저장**하므로 프론트에는 노출되지 않습니다.

## 배포 및 API 키 설정

1. **Supabase CLI 설치** (최초 1회)
   - https://supabase.com/docs/guides/cli

2. **프로젝트 폴더에서 로그인·연결** (⚠️ 반드시 mvp1 폴더에서 실행)
   ```bash
   cd C:\Users\wnd12\Desktop\mvp1
   npx supabase login
   npx supabase link --project-ref donxoyznlahewufadamu
   ```
   - 다른 폴더에서 deploy 하면 `Entrypoint path does not exist` 오류가 납니다.

3. **Edge Function 배포** (CORS 방지를 위해 `--no-verify-jwt` 사용)
   ```bash
   cd C:\Users\wnd12\Desktop\mvp1
   npx supabase functions deploy analyze-tags --no-verify-jwt
   ```

4. **Google Gemini API 키를 Supabase Secrets에 설정**
   - Google AI Studio: https://aistudio.google.com/apikey 에서 API 키 발급
   - Supabase 대시보드: **Edge Functions** → **Secrets** (또는 **Project Settings** → **Edge Functions** → **Secrets**)
   - `GEMINI_API_KEY` = 발급받은 Gemini API 키

   또는 CLI:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=AIza...
   ```

이후 웹 앱에서 사진 추가 시 Edge Function이 Gemini를 호출하고, 키가 있으면 AI 태그가 생성됩니다.

**동작 요약:** 클라이언트가 보낸 `exifData.photoDate`(ISO)를 **한국 시각(Asia/Seoul)** 으로 해석해, 일몰·야경·일출 등 시간대 태그가 촬영 시각과 맞도록 프롬프트·후처리합니다. 프롬프트 변경만으로는 부족할 수 있어 Edge 함수 **재배포**가 필요합니다.

## CORS 오류가 날 때

브라우저에서 `analyze-tags` 호출 시 CORS 오류가 나면:

1. **프로젝트 폴더에서** 재배포: `cd C:\Users\wnd12\Desktop\mvp1` 후 `npx supabase functions deploy analyze-tags --no-verify-jwt`
2. **GEMINI_API_KEY** 가 설정되었는지 확인 (없으면 500이 나며 CORS처럼 보일 수 있음)
3. Supabase 대시보드 → **Edge Functions** → 해당 함수 설정에서 **Enforce JWT** 가 꺼져 있으면, anon 키만으로 호출 가능합니다. 필요 시 JWT 검사 비활성화 후 재배포
