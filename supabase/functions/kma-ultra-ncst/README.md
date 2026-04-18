# kma-ultra-ncst

기상청 초단기실황 API 프록시. 인증키는 Supabase Secrets에만 저장합니다.

## 설정

```bash
supabase secrets set KMA_API_KEY=공공데이터포털에서_발급한_키
# 또는
supabase secrets set DATA_GO_KR_SERVICE_KEY=...
```

## 배포

```bash
supabase functions deploy kma-ultra-ncst
```

프론트는 `VITE_SUPABASE_URL`이 있으면 자동으로  
`{SUPABASE_URL}/functions/v1/kma-ultra-ncst` 를 호출합니다 (`VITE_SUPABASE_ANON_KEY` 헤더 필요).
