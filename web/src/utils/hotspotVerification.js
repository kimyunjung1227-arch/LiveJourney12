/**
 * [라이브저니] 실시간 핫플 — 검증 레이어 (Verification Layer)
 * "진실인가?" — 피드가 올라오는 즉시 가짜 정보를 걸러내는 필터
 */

import { getPostAccuracyCount } from './socialInteractions';
import { getPostAgeInHours } from './timeUtils';

const getPostTimeMs = (post) => {
  const raw = post?.timestamp || post?.createdAt || post?.time;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const getPostCoords = (post) => {
  const c = post?.coordinates;
  if (c && (c.lat != null || c.latitude != null) && (c.lng != null || c.longitude != null)) {
    return { lat: Number(c.lat ?? c.latitude), lng: Number(c.lng ?? c.longitude) };
  }
  if (post?.location && typeof post.location === 'object') {
    const lat = post.location.lat ?? post.location.latitude;
    const lng = post.location.lng ?? post.location.lon ?? post.location.longitude;
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
};

/**
 * 1) 시공간 동기화: 사진의 GPS·촬영 시간이 현재와 일치하는지 1차 검증
 * - 좌표 존재 + 촬영/업로드 시간이 48시간 이내 → 통과
 */
export const verifySpatiotemporal = (post) => {
  const coords = getPostCoords(post);
  const hasLocation = !!(coords || (post?.location && typeof post.location === 'string' && post.location.trim().length > 0));
  const ageHours = getPostAgeInHours(post?.timestamp || post?.createdAt);
  const isRecent = ageHours < 48;
  const score = hasLocation && isRecent ? 1 : (hasLocation ? 0.6 : 0.2);
  return { pass: score >= 0.5, score, hasLocation, isRecent };
};

/**
 * 2) AI 상황 분석 (스텁): 그림자·하늘·밀도 분석은 백엔드/엣지에서 수행 가능
 * - 클라이언트에서는 이미지·위치·시간 존재 여부로 신뢰도 근사
 */
export const verifyAISituation = (post) => {
  const hasImage = !!(post?.images?.[0] || post?.image || post?.thumbnail || post?.videos?.[0]);
  const hasLocation = !!getPostCoords(post) || (post?.location && String(post.location).trim());
  const ageHours = getPostAgeInHours(post?.timestamp || post?.createdAt);
  const freshness = Math.max(0, 1 - ageHours / 6);
  const confidence = (hasImage ? 0.4 : 0) + (hasLocation ? 0.3 : 0) + freshness * 0.3;
  return { confidence: Math.min(1, confidence), hasImage, hasLocation };
};

/**
 * 3) 라이브 싱크 가중치(간이): 평소 정확한 정보를 올렸던 사용자에게 더 높은 점수
 * - 현재는 게시물별 '정확해요' 수만 반영(데이터 안정성 우선)
 */
export const getTrustWeight = (post) => {
  const accuracyCount = getPostAccuracyCount(post?.id);
  let authorScore = 0.5;
  // 서버 운영 전환: localStorage 기반 self 판별 제거
  void post;
  const postTrust = Math.min(1, 0.5 + (accuracyCount || 0) * 0.05);
  return authorScore * 0.4 + postTrust * 0.6;
};

/**
 * 통합 검증: 필터 통과 여부 + 검증 점수 (0~1)
 */
export const verifyPost = (post) => {
  const st = verifySpatiotemporal(post);
  const ai = verifyAISituation(post);
  const trustWeight = getTrustWeight(post);
  const combined = (st.score * 0.4 + ai.confidence * 0.4 + trustWeight * 0.2);
  const pass = st.pass && combined >= 0.35;
  return {
    pass,
    score: Math.min(1, combined),
    spatiotemporal: st,
    ai: ai,
    trustWeight,
  };
};

/**
 * 피드 배열에 검증 적용 후 통과한 것만 반환 (옵션: 점수 부여하여 정렬용으로 사용)
 */
export const filterVerifiedPosts = (posts, options = {}) => {
  const { minScore = 0.35, attachScore = true } = options;
  return (posts || [])
    .map((p) => {
      const v = verifyPost(p);
      if (!v.pass || v.score < minScore) return null;
      return attachScore ? { ...p, _verification: v } : p;
    })
    .filter(Boolean);
};
