import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAward, IconChevronRight } from '@tabler/icons-react';

import { buildBadgeGroups } from './badgeData';

const KEY_DARK = '#1A6EA8';
const TEXT_SECONDARY = '#6B6B6B';
const SECTION_LABEL = '#4A7DA8';

/**
 * 라이브저니 뱃지 박스 (프로필 메인).
 * - 섹션 별 헤더 + 보유한 뱃지를 강조해서 노출
 * - 우상단 "전체보기" → /profile/badges
 */
export default function BadgesBox({ user }) {
  const navigate = useNavigate();
  if (!user) return null;

  const groups = buildBadgeGroups(user);
  const totalEarned = groups.reduce(
    (acc, g) => acc + g.items.filter((i) => i.earned).length,
    0,
  );
  const totalAll = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div
      style={{
        margin: '0 18px 14px',
        padding: 16,
        borderRadius: 13,
        background: 'linear-gradient(135deg, #F0F9FE, #FBFDFF)',
        border: '1px solid rgba(77, 184, 232, 0.18)',
      }}
    >
      <div
        className="flex items-center"
        style={{ marginBottom: 14, justifyContent: 'space-between' }}
      >
        <div className="flex items-center gap-1.5">
          <IconAward size={13} color={KEY_DARK} stroke={2.2} />
          <span style={{ fontSize: 12, fontWeight: 700, color: KEY_DARK, letterSpacing: 0.2 }}>
            뱃지
          </span>
          <span style={{ fontSize: 11, color: TEXT_SECONDARY, marginLeft: 2 }}>
            {totalEarned}/{totalAll}
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

      {groups.map((group, idx) => (
        <BadgeSection
          key={group.label}
          label={group.label}
          items={group.items}
          isLast={idx === groups.length - 1}
        />
      ))}
    </div>
  );
}

function BadgeSection({ label, items, isLast = false }) {
  return (
    <div style={{ marginBottom: isLast ? 0 : 14 }}>
      <p
        className="m-0"
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: SECTION_LABEL,
          letterSpacing: 0.4,
          marginBottom: 10,
        }}
      >
        {label}
      </p>
      <div className="flex flex-wrap" style={{ gap: 12 }}>
        {items.map((item) => (
          <BadgeChip key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

/**
 * 강조된 뱃지 칩 — 동그란 하이라이트 배경 + 그림자 + 미획득 처리.
 */
export function BadgeChip({ item, size = 56 }) {
  const { img, name, earned } = item;
  const ringSize = size;
  const imgSize = Math.round(size * 0.78);

  return (
    <div
      aria-label={`${name}${earned ? '' : ' (미획득)'}`}
      title={name}
      className="flex items-center justify-center"
      style={{
        width: ringSize,
        height: ringSize,
        borderRadius: '50%',
        background: earned
          ? 'radial-gradient(circle at 30% 25%, #FFFFFF 0%, #DCEEFB 70%, #C0DFF5 100%)'
          : '#F1F2F4',
        border: earned ? '1.5px solid rgba(77, 184, 232, 0.55)' : '1px solid #E5E7EB',
        boxShadow: earned
          ? '0 4px 10px rgba(77, 184, 232, 0.22), inset 0 1px 2px rgba(255,255,255,0.9)'
          : 'none',
        opacity: earned ? 1 : 0.55,
        flexShrink: 0,
      }}
    >
      <img
        src={img}
        alt=""
        style={{
          width: imgSize,
          height: imgSize,
          objectFit: 'contain',
          filter: earned ? 'none' : 'grayscale(1)',
        }}
      />
    </div>
  );
}
