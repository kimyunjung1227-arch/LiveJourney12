import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * 전역 badgeEarned 이벤트를 받아 "뱃지 달성 축하 화면"으로 자동 이동.
 * - 어디서 뱃지를 획득하든 자동 노출
 * - 연속 획득 시 중복 네비게이션 최소화
 */
export default function BadgeEarnedNavigator() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastKeyRef = useRef('');

  useEffect(() => {
    const handler = (e) => {
      const badge = e?.detail;
      if (!badge || !badge.name) return;

      // 축하 화면 자체에서 다시 이벤트가 오면 루프 방지
      if (location?.pathname?.startsWith('/badge')) return;

      const key = `${badge.name}::${badge.earnedAt || ''}`;
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;

      navigate('/badge/achievement', { state: { badge }, replace: false });
    };

    window.addEventListener('badgeEarned', handler);
    return () => window.removeEventListener('badgeEarned', handler);
  }, [navigate, location?.pathname]);

  return null;
}

