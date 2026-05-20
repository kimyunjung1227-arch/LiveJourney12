import React from 'react';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';

/**
 * 부차적인 일반 통계 (사진/팔로워/팔로잉). 영예 박스 아래 작게.
 */
export default function BasicStats({ user, onFollowerClick, onFollowingClick }) {
  if (!user) return null;
  return (
    <div
      className="flex items-center"
      style={{
        gap: 20,
        padding: '0 18px 20px',
      }}
    >
      <StatRow value={user.photo_count || 0} label="사진" />
      <StatRow
        value={user.follower_count || 0}
        label="팔로워"
        onClick={onFollowerClick}
      />
      <StatRow
        value={user.following_count || 0}
        label="팔로잉"
        onClick={onFollowingClick}
      />
    </div>
  );
}

function StatRow({ value, label, onClick }) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className="flex items-baseline gap-1.5"
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>{value}</span>
      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
    </button>
  );
}
