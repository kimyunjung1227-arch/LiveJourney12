import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAward, IconChevronRight } from '@tabler/icons-react';

import {
  BADGE_CATALOG,
  resolveEarnedBadges,
  getPillColors,
} from './badgeData';

const KEY_DARK = '#1A6EA8';
const TEXT_SECONDARY = '#6B6B6B';

/**
 * 프로필 메인의 뱃지 박스.
 * - 획득한 뱃지만 표시 (아이콘 + pill 라벨)
 * - 클릭 시 /profile/badges/:badgeKey 로 이동
 */
export default function BadgesBox({ user }) {
  const navigate = useNavigate();
  if (!user) return null;

  const earnedKeys = Array.isArray(user.earned_badges) ? user.earned_badges : [];
  const earned = resolveEarnedBadges(earnedKeys);

  return (
    <div style={{ padding: '0 18px', marginBottom: 16 }}>
      <div
        className="flex items-center"
        style={{ marginBottom: 12, justifyContent: 'space-between' }}
      >
        <div className="flex items-center gap-1.5">
          <IconAward size={14} color="#1F1F1F" stroke={2.2} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1F1F1F' }}>
            뱃지
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile/badges')}
          className="flex items-center"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: KEY_DARK,
            fontSize: 11,
            fontWeight: 700,
            gap: 2,
          }}
        >
          전체보기
          <IconChevronRight size={13} stroke={2.2} />
        </button>
      </div>

      {earned.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: TEXT_SECONDARY,
            padding: '8px 0',
          }}
        >
          아직 획득한 뱃지가 없어요. 활동을 쌓으면 자동으로 부여됩니다.
        </div>
      ) : (
        <div className="flex flex-wrap" style={{ gap: 14 }}>
          {earned.map((meta) => (
            <EarnedBadge
              key={meta.key}
              meta={meta}
              onClick={() => navigate(`/profile/badges/${meta.key}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 획득 뱃지 — 아이콘 (테두리 없음) + pill 라벨.
 */
function EarnedBadge({ meta, onClick }) {
  const pill = getPillColors(meta.tier);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={meta.name}
      className="flex flex-col items-center"
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        gap: 6,
      }}
    >
      <img
        src={meta.img}
        alt=""
        style={{
          width: 60,
          height: 60,
          objectFit: 'contain',
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: pill.text,
          background: pill.bg,
          border: `1px solid ${pill.border}`,
          padding: '4px 10px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
      >
        {meta.name}
      </span>
    </button>
  );
}

/**
 * 전체보기 화면에서 사용하는 큰 뱃지 칩 — 외부 export 유지 (BadgesScreen 호환).
 */
export function BadgeChip({ item, size = 60 }) {
  return (
    <img
      src={item.img}
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: item.earned ? 'none' : 'grayscale(1)',
        opacity: item.earned ? 1 : 0.45,
      }}
    />
  );
}
