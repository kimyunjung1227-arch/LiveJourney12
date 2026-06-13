import React from 'react';
import { IconCrown, IconPencil } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

/**
 * 프로필 상단 영역: 아바타(왕관 인디케이터) + 이름(베스트 컷 작가 라벨) + 바이오.
 *
 * @param {object} props
 * @param {object} props.user
 * @param {boolean} [props.isMe] /profile 컨텍스트면 true → 팔로워/팔로잉 클릭 시 /profile/follows
 */
export default function ProfileHeader({ user, isMe = false, trailingSlot = null }) {
  const navigate = useNavigate();
  if (!user) return null;

  const initial = String(user.name || '?').trim().charAt(0).toUpperCase() || '·';
  const avatarUrl = user.avatar_url ? getDisplayImageUrl(user.avatar_url) : '';
  const isArtist = !!user.is_best_cut_artist;

  return (
    <div style={{ padding: '14px 18px 10px' }}>
      <div className="flex items-start gap-3">
        {/* 아바타 + 왕관 인디케이터 */}
        <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
          <div
            className="flex items-center justify-center rounded-full overflow-hidden"
            style={{
              width: 52,
              height: 52,
              background: user.avatar_color || KEY,
              color: 'white',
              fontSize: 19,
              fontWeight: 700,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Google/Kakao CDN 등 외부 이미지가 referer 차단으로 깨질 때 이니셜로 폴백
                  e.currentTarget.style.display = 'none';
                }}
              />
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
                width: 20,
                height: 20,
                borderRadius: 999,
                background: GRADIENT,
                border: '2px solid white',
              }}
            >
              <IconCrown size={11} color="white" stroke={2.2} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
            <h2 className="m-0" style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}>
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
            {isMe ? (
              <button
                type="button"
                onClick={() => navigate('/profile/edit')}
                aria-label="프로필 편집"
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  marginLeft: 'auto',
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <IconPencil size={15} color={TEXT_SECONDARY} stroke={1.8} />
              </button>
            ) : trailingSlot ? (
              <div style={{ marginLeft: 'auto' }}>{trailingSlot}</div>
            ) : null}
          </div>

          {user.bio ? (
            <p
              className="m-0"
              style={{
                fontSize: 12.5,
                lineHeight: 1.5,
                color: TEXT_PRIMARY,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 8,
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
                marginBottom: 8,
              }}
            >
              지금, 당신의 여행을 실시간으로
            </p>
          )}

          {/* 게시물/팔로워/팔로잉 — 정보 컬럼 안쪽(아바타 우측)에 배치 */}
          <div className="flex items-baseline" style={{ gap: 14 }}>
            <InlineStat value={user.photo_count || 0} label="게시물" />
            <InlineStat
              value={user.follower_count || 0}
              label="팔로워"
              onClick={() => {
                if (isMe) navigate('/profile/follows?tab=followers');
                else if (user?.id) navigate(`/user/${encodeURIComponent(user.id)}/follows?tab=followers`);
              }}
            />
            <InlineStat
              value={user.following_count || 0}
              label="팔로잉"
              onClick={() => {
                if (isMe) navigate('/profile/follows?tab=following');
                else if (user?.id) navigate(`/user/${encodeURIComponent(user.id)}/follows?tab=following`);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineStat({ value, label, onClick }) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className="flex items-baseline gap-1"
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{value}</span>
      <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>{label}</span>
    </Tag>
  );
}
