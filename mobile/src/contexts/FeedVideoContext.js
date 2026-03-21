import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const FeedVideoContext = createContext(null);

/**
 * 동시에 1개만 재생. playPriority 숫자가 작을수록 우선(지금 여기는=0, 핫플=1, 추천=2).
 * 상위 우선 피드가 놓이면 하위는 request가 무시됨. release/clear 후 playGeneration 증가로 재시도.
 */
export function FeedVideoProvider({ children }) {
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [playGeneration, setPlayGeneration] = useState(0);
  const activeMetaRef = useRef({ id: null, priority: 999 });

  const requestPlay = useCallback((id, priority = 100) => {
    const prev = activeMetaRef.current;
    if (prev.id === id) return;
    if (!prev.id) {
      activeMetaRef.current = { id, priority };
      setActivePlayerId(id);
      return;
    }
    if (priority < prev.priority) {
      activeMetaRef.current = { id, priority };
      setActivePlayerId(id);
      return;
    }
    if (priority > prev.priority) return;
    // 동일 우선순위: 먼저 잡은 플레이어 유지(지금 여기는 카드가 먼저 마운트되도록 리스트 순서에 맡김)
  }, []);

  const release = useCallback((id) => {
    if (activeMetaRef.current.id !== id) return;
    activeMetaRef.current = { id: null, priority: 999 };
    setActivePlayerId(null);
    setPlayGeneration((g) => g + 1);
  }, []);

  const clearAll = useCallback(() => {
    activeMetaRef.current = { id: null, priority: 999 };
    setActivePlayerId(null);
    setPlayGeneration((g) => g + 1);
  }, []);

  const value = useMemo(
    () => ({ activePlayerId, playGeneration, requestPlay, release, clearAll }),
    [activePlayerId, playGeneration, requestPlay, release, clearAll]
  );

  return <FeedVideoContext.Provider value={value}>{children}</FeedVideoContext.Provider>;
}

export function useFeedVideo() {
  const ctx = useContext(FeedVideoContext);
  if (!ctx) {
    return {
      activePlayerId: null,
      playGeneration: 0,
      requestPlay: () => {},
      release: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}
