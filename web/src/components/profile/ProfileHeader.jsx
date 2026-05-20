import React from 'react';
import { IconCrown } from '@tabler/icons-react';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

/**
 * 프로필 상단 영역: 아바타(왕관 인디케이터) + 이름(베스트 컷 작가 라벨) + 바이오.
 */
export default function ProfileHeader({ user }) {
  if (!user) return null;

  const initial = String(user.name || '?').trim().charAt(0).toUpperCase() || '·';
  const avatarUrl = user.avatar_url ? getDisplayImageUrl(user.avatar_url) : '';
  const isArtist = !!user.is_best_cut_artist;

  return (
    <div style={{ padding: '20px 18px 14px' }}>
      <div className="flex items-start gap-4">
        {/* 아바타 + 왕관 인디케이터 */}
        <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
          <div
            className="flex items-center justify-center rounded-full overflow-hidden"
            style={{
              width: 72,
              height: 72,
              background: user.avatar_color || KEY,
              color: 'white',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          {isArtist && (
            <div
              className="absolute flex items-center justify-center"
              style={{
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: 999,
                background: GRADIENT,
                border: '2.5px solid white',
              }}
            >
              <IconCrown size={13} color="white" stroke={2.2} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
            <h2 className="m-0" style={{ fontSize: 19, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}>
              {user.name}
            </h2>
            {isArtist && (
              <div
                className="flex items-center gap-1"
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: GRADIENT,
                }}
              >
                <IconCrown size={10} color="white" stroke={2.4} />
                <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>
                  베스트 컷 작가
                </span>
              </div>
            )}
          </div>

          {user.bio ? (
            <p
              className="m-0"
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: TEXT_PRIMARY,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 10,
              }}
            >
              {user.bio}
            </p>
          ) : (
            <p
              className="m-0"
              style={{
                fontSize: 12,
                color: TEXT_SECONDARY,
                marginBottom: 10,
              }}
            >
              지금, 당신의 여행을 실시간으로
            </p>
          )}

          {/* 게시물/팔로워/팔로잉 — 정보 컬럼 안쪽(아바타 우측)에 배치 */}
          <div className="flex items-baseline" style={{ gap: 16 }}>
            <InlineStat value={user.photo_count || 0} label="게시물" />
            <InlineStat value={user.follower_count || 0} label="팔로워" />
            <InlineStat value={user.following_count || 0} label="팔로잉" />
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineStat({ value, label }) {
  return (
    <div className="flex items-baseline gap-1">
      <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>{value}</span>
      <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>{label}</span>
    </div>
  );
}
