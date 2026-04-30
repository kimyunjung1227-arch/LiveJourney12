import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 게스트(비로그인)도 "구경"은 가능하게 두고,
 * 행동(좋아요/댓글/업로드 등) 시 로그인으로 자연스럽게 유도하기 위한 공통 게이트.
 *
 * @returns {(actionLabel?: string) => boolean} 로그인 상태면 true, 게스트면 false(유도 처리)
 */
export function useLoginGate() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (actionLabel = '이 기능') => {
      if (isAuthenticated) return true;
      const ok = window.confirm(`${actionLabel}은(는) 로그인 후 사용할 수 있어요.\n지금 로그인할까요?`);
      if (ok) {
        navigate('/start', {
          state: { from: location.pathname || '/' },
        });
      }
      return false;
    },
    [isAuthenticated, navigate, location.pathname]
  );
}

