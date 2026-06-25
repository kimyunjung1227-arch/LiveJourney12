import { useEffect, useRef, useState } from 'react';

const storageKey = (uid) => `lj_liveguide_level_v1_${uid}`;

function readStored(uid) {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return raw == null ? null : Number(raw);
  } catch {
    return null;
  }
}
function writeStored(uid, level) {
  try {
    localStorage.setItem(storageKey(uid), String(level));
  } catch {
    /* noop */
  }
}

/**
 * 라이브가이드 "달성 순간"을 감지해 축하 연출을 트리거하는 훅.
 *
 * - 마지막으로 본 등급을 localStorage 에 저장한다.
 * - 최초 1회는 기준선만 저장(기존 가이드는 축하 없음).
 * - 비가이드(0) → 가이드(≥1) 진입, 또는 탑(3) 첫 도달 시 축하.
 * - 등급이 내려가면 조용히 동기화 → 재획득 시 다시 축하한다.
 *
 * @param {object} args
 * @param {string|null} args.userId
 * @param {number} args.level  현재 등급 (0=비가이드)
 * @param {boolean} args.loading
 * @param {boolean} [args.enabled] 본인 프로필일 때만 true
 */
export function useLiveGuideCelebration({ userId, level, loading, enabled = true }) {
  const [celebrateLevel, setCelebrateLevel] = useState(null);
  const firedRef = useRef(false); // 세션 내 중복 방지

  useEffect(() => {
    if (!enabled || !userId || loading) return;
    const cur = Number(level) || 0;
    const stored = readStored(userId);

    // 최초 기준선 — 축하 없이 저장 (기존 가이드 보호)
    if (stored == null || !Number.isFinite(stored)) {
      writeStored(userId, cur);
      return;
    }

    const becameGuide = stored < 1 && cur >= 1;
    const becameTop = stored < 3 && cur >= 3;

    if ((becameGuide || becameTop) && !firedRef.current) {
      firedRef.current = true;
      setCelebrateLevel(cur);
      writeStored(userId, cur);
    } else if (cur !== stored) {
      // 등급 하락/중간 변동은 조용히 동기화
      writeStored(userId, cur);
    }
  }, [userId, level, loading, enabled]);

  const dismiss = () => setCelebrateLevel(null);
  return { celebrateLevel, dismiss };
}
