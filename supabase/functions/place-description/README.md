# Edge Function: place-description (Anthropic Claude)

핫플 카드에서 사용할 **명확한 장소 소개 문단**을 Anthropic Claude로 생성합니다.  
API 키는 **Supabase Secrets**에만 저장되므로 프론트에는 노출되지 않습니다.

## 배포 및 API 키 설정

1) (최초 1회) Supabase CLI 로그인/연결

```bash
cd C:\Users\wnd12\Desktop\mvp1
npx supabase login
npx supabase link --project-ref donxoyznlahewufadamu
```

2) Edge Function 배포

```bash
cd C:\Users\wnd12\Desktop\mvp1
npx supabase functions deploy place-description --no-verify-jwt
```

3) Supabase Secrets 설정

- Supabase 대시보드 → **Edge Functions** → **Secrets**
  - `ANTHROPIC_API_KEY` = Anthropic API 키 (`sk-ant-...`)
  - (선택) `CLAUDE_PLACE_MODEL` = 예: `claude-opus-4-8` (기본값), `claude-sonnet-4-6`

또는 CLI:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## 요청/응답

- Request(JSON):
  - `placeKey` (필수)
  - `regionHint`, `tier`, `tags`, `userCaptions` (선택)
- Response(JSON):
  - `success`
  - `description`
  - `method`

