/** 기본 SEO 문구(문서 메타·RootSeo·index.html과 동일하게 유지) */
export const SEO_DEFAULT = {
  title: "라이브저니 - 여행지의 '지금'을 연결하는 실시간 커뮤니티",
  description:
    "여행지의 지금 날씨·현장·인파를 실시간 제보로 확인하세요. 시차 없는 정보로 실패 없는 일정을 돕는 라이브저니 커뮤니티.",
  keywords:
    "라이브저니, Live Journey, 실시간 여행, 여행 커뮤니티, 실시간 제보, 여행 정보, 혼잡도, 날씨, 지도",
  siteName: "라이브저니",
  // 검색/미리보기에서 특정 이미지가 노출되지 않도록 투명 1x1로 지정
  ogImageFilename: "og-empty.svg",
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
