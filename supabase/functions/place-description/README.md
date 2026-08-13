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
  - `ANTHROPIC_API_KEY` = Anthropic API 키 (`sk-ant-...`) — **없으면 함수가 항상 500** 이라
    화면에는 AI 소개 대신 임시 문구만 나온다.
  - (선택) `CLAUDE_PLACE_MODEL` = 예: `claude-opus-5` (기본값), `claude-sonnet-5`

또는 CLI:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## 잘 나오는지 확인

```bash
curl -X POST "https://donxoyznlahewufadamu.supabase.co/functions/v1/place-description" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon key>" \
  -d '{"placeKey":"석촌호수","regionHint":"서울 송파구"}'
```

응답의 `method` 로 어디서 온 글인지 알 수 있다.

| `method` | 의미 |
| --- | --- |
| `supabase-edge-claude` | Claude 가 새로 생성 (정상) |
| `cache-db` | 이번 달에 이미 생성된 글을 서버 캐시에서 재사용 (정상) |
| `curated` | 코드에 박아둔 고정 문구 |
| `fallback-local` | Claude 호출 실패 → 임시 문구. `reason`/`detail` 에 원인이 담긴다 |

## 요청/응답

- Request(JSON):
  - `placeKey` (필수)
  - `regionHint`, `tier`, `tags`, `userCaptions` (선택)
- Response(JSON):
  - `success`
  - `description`
  - `method`

