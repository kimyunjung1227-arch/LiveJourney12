# LiveJourney — Supabase Edge Function `kma-ultra-ncst` 배포
# 사용: 프로젝트 루트에서  powershell -ExecutionPolicy Bypass -File .\scripts\supabase-deploy-kma.ps1
# 또는: npm run supabase:deploy:kma

$ErrorActionPreference = "Stop"
# scripts\ 폴더 기준 한 단계 위 = 저장소 루트
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "supabase\functions\kma-ultra-ncst\index.ts"))) {
  Write-Host "오류: supabase/functions/kma-ultra-ncst 를 찾을 수 없습니다. 저장소 루트에서 실행하세요." -ForegroundColor Red
  exit 1
}
Set-Location $root

Write-Host ""
Write-Host "=== Supabase CLI (npx) ===" -ForegroundColor Cyan
npx --yes supabase@latest --version

$ProjectRef = "donxoyznlahewufadamu"

Write-Host ""
Write-Host "프로젝트 ref: $ProjectRef" -ForegroundColor Gray
Write-Host "아래는 최초 1회만 필요합니다." -ForegroundColor Yellow
Write-Host "  로그인: 터미널에 직접 입력 (npm 말고) — npx supabase@latest login"
Write-Host "  링크: npm run supabase:link   (--yes 포함, npm에서 stdin 오류 방지)"
Write-Host ""
Write-Host "기상청 키(시크릿) 설정 예:" -ForegroundColor Yellow
Write-Host "  npx supabase@latest secrets set --project-ref $ProjectRef KMA_API_KEY=공공데이터포털_인증키"
Write-Host ""

Write-Host "=== functions deploy kma-ultra-ncst ===" -ForegroundColor Cyan
npx --yes supabase@latest functions deploy kma-ultra-ncst --project-ref $ProjectRef --no-verify-jwt

Write-Host ""
Write-Host "완료." -ForegroundColor Green
