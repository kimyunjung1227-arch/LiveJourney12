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

/** 주요 화면별 검색 스니펫·사이트링크 후보 URL과 일치시키는 문구 */
export const PAGE_SEO = {
  main: {
    title: "지금 여기는 · 라이브저니 홈",
    description:
      "메인 피드에서 여행지의 지금 날씨·현장·인파를 실시간 제보로 확인하세요. 지금 여기는·실시간 핫플·추천 코스를 한곳에서.",
    path: "/main",
  },
  crowdedPlace: {
    title: "실시간 핫플 · 라이브저니",
    description:
      "지금 반응이 뜨거운 여행지·핫플을 실시간 순위와 현장 제보로 확인하고, 장소별 게시물을 모아 볼 수 있습니다.",
    path: "/crowded-place",
  },
  map: {
    title: "지도 · 라이브저니",
    description:
      "여행지 주변 실시간 제보와 게시물을 지도에서 탐색하고, 장소 검색으로 인파·분위기를 미리 파악하세요.",
    path: "/map",
  },
  profile: {
    title: "프로필 · 라이브저니",
    description:
      "내 여행 기록·인증·팔로우와 라이브저니 활동을 관리하는 프로필 화면입니다.",
    path: "/profile",
  },
  termsOfService: {
    title: "서비스 이용약관 · 라이브저니",
    description:
      "라이브저니(LiveJourney) 서비스 이용약관 전문. 회원·비회원의 권리·의무 및 서비스 제공 조건을 규정합니다.",
    path: "/terms-of-service",
  },
}
