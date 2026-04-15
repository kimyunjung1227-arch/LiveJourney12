import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * 전역 badgeEarned 이벤트를 받아 "뱃지 달성 축하 화면"으로 자동 이동.
 * - 어디서 뱃지를 획득하든 자동 노출
 * - 연속 획득 시 중복 네비게이션 최소화
 */
export default function BadgeEarnedNavigator() {
  useEffect(() => {
    // 사용 요청: 라이브 뱃지 획득 축하 화면(자동 이동) 비활성화
    return undefined;
  }, []);

  return null;
}

