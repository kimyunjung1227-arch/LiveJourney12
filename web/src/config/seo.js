/** 기본 SEO 문구(문서 메타·RootSeo와 동일하게 유지) */
export const SEO_DEFAULT = {
  title: "라이브저니 - 여행지의 '지금'을 연결하는 실시간 커뮤니티",
  description:
    "실시간 제보를 확인하고 실패 없는 여행을 계획하세요. 정보의 시차 없는 가장 빠른 여행 정보 공유 플랫폼",
  keywords:
    "라이브저니, 라이브 저니, Live Journey, 실시간 여행, 여행 앱, 여행 커뮤니티, 여행 정보, 여행 필수 앱, 실시간 여행 정보",
  siteName: "라이브저니",
  ogImageFilename: "logo.svg",
}

/**
 * 공개 사이트 절대 URL(trailing slash 없음).
 * 배포 도메인이 다르면 빌드 시 VITE_SITE_URL(예: https://livejourney.co.kr 또는 서브경로 배포 시 전체 베이스 URL).
 */
export function getPublicBaseUrl() {
  const env =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL
      ? String(import.meta.env.VITE_SITE_URL).trim()
      : ""
  if (env) return env.replace(/\/$/, "")

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || ""
    return base ? `${origin}${base}` : origin
  }

  return "https://livejourney.co.kr"
}

export function getDefaultOgImageUrl() {
  const base = getPublicBaseUrl()
  return new URL(SEO_DEFAULT.ogImageFilename, `${base}/`).href
}
