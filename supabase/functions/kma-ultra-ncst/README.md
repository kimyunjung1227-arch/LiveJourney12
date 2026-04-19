# kma-ultra-ncst

기상청 초단기실황 API 프록시. 인증키는 Supabase Secrets에만 저장합니다.

## 설정

```bash
supabase secrets set KMA_API_KEY=공공데이터포털에서_발급한_키
# 또는
supabase secrets set DATA_GO_KR_SERVICE_KEY=...
```

## 배포

프로젝트 ref `donxoyznlahewufadamu` 가 저장소 `package.json` / `supabase/config.toml` 에 맞춰져 있음.

```bash
# 저장소 루트에서
npm run supabase:deploy:kma
# 또는
npx supabase@latest functions deploy kma-ultra-ncst --project-ref donxoyznlahewufadamu
```

프론트는 `VITE_SUPABASE_URL`이 있으면 자동으로  
`{SUPABASE_URL}/functions/v1/kma-ultra-ncst` 를 호출합니다 (anon 키는 URL 쿼리 `apikey` 로 전달).
