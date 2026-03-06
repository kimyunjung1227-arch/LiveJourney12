# Edge Function: analyze-tags (Google Gemini)

이미지를 **Google Gemini**(gemini-1.5-flash)로 분석해 여행/장소 해시태그를 생성합니다.  
**API 키는 Supabase Secrets에만 저장**하므로 프론트에는 노출되지 않습니다.

## 배포 및 API 키 설정

1. **Supabase CLI 설치** (최초 1회)
   - https://supabase.com/docs/guides/cli

2. **로그인 및 프로젝트 연결**
   ```bash
   npx supabase login
   npx supabase link --project-ref <프로젝트 ref>
   ```
   - 프로젝트 ref: Supabase 대시보드 URL의 `https://app.supabase.com/project/<ref>` 에서 확인

3. **Edge Function 배포**
   ```bash
   npx supabase functions deploy analyze-tags
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

## CORS 오류가 날 때

브라우저에서 `analyze-tags` 호출 시 CORS 오류가 나면:

1. **Edge Function이 배포되었는지** 확인: `npx supabase functions deploy analyze-tags`
2. **GEMINI_API_KEY** 가 설정되었는지 확인 (없으면 500이 나며 CORS처럼 보일 수 있음)
3. Supabase 대시보드 → **Edge Functions** → 해당 함수 설정에서 **Enforce JWT** 가 꺼져 있으면, anon 키만으로 호출 가능합니다. 필요 시 JWT 검사 비활성화 후 재배포
