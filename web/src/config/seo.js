/** 기본 SEO 문구(문서 메타·RootSeo·index.html과 동일하게 유지) */
export const SEO_DEFAULT = {
  title: "라이브저니 — 정보 시차 없는 진짜 여행의 시작",
  description:
    "지금 날씨, 인파, 분위기까지 현지 실시간 제보로 확인하세요.",
  keywords:
    "라이브저니, Live Journey, 실시간 여행, 여행 커뮤니티, 실시간 제보, 여행 정보, 혼잡도, 날씨, 인파, 핫플, 라이브매거진, 실시간 Q&A, 지도",
  siteName: "라이브저니",
}

/**
 * 구글 검색 결과의 이미지 미리보기·이미지 검색 색인을 최소화할 때 사용하는 기본값.
 * index.html의 meta robots와 맞춰 두세요.
 */
export const SEO_ROBOTS_DEFAULT =
  "index, follow, max-image-preview: none, noimageindex"

/** 라우트별 robots 문자열에 이미지 관련 힌트가 없으면 덧붙입니다. */
export function withGoogleImageRobotsHints(robots) {
  const base = (robots && String(robots).trim()) || "index, follow"
  const parts = base.split(",").map((s) => s.trim()).filter(Boolean)
  const keys = new Set(
    parts.map((p) => {
      const i = p.indexOf(":")
      return (i === -1 ? p : p.slice(0, i)).trim().toLowerCase()
    })
  )
  if (!keys.has("max-image-preview")) parts.push("max-image-preview: none")
  if (!keys.has("noimageindex")) parts.push("noimageindex")
  return parts.join(", ")
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

/** 주요 화면별 검색 스니펫·사이트링크 후보 URL과 일치시키는 문구 */
export const PAGE_SEO = {
  main: {
    title: "실시간 현장 LIVE · 라이브저니",
    description: "오늘 그곳의 날씨·인파·현장 분위기를 실시간 확인",
    path: "/main",
  },
  realtimeFeed: {
    title: "실시간 현장 LIVE · 라이브저니",
    description: "오늘 그곳의 날씨·인파·현장 분위기를 실시간 확인",
    path: "/realtime-feed",
  },
  crowdedPlace: {
    title: "실시간 핫플 · 라이브저니",
    description: "지금 사람들이 몰리는 진짜 핫플 확인",
    path: "/crowded-place",
  },
  magazine: {
    title: "라이브매거진 · 라이브저니",
    description: "이번 시즌 꼭 가봐야 할 여행 가이드",
    path: "/magazine",
  },
  askSituation: {
    title: "실시간 Q&A · 라이브저니",
    description: "현지에 있는 사람에게 직접 물어보세요",
    path: "/ask-situation",
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
