import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useFollow } from '../hooks/useFollow';
import { getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';

const TABS = [
  { id: 'followers', label: '팔로워' },
  { id: 'following', label: '팔로잉' },
];

function useFollowList(userId, kind) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !kind) {
      setList([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_follow_list', {
          p_user_id: userId,
          p_kind: kind,
          p_limit: 200,
          p_offset: 0,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_follow_list 실패', error?.message || error);
          setList([]);
        } else {
          setList(Array.isArray(data) ? data : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, kind]);

  return { list, setList, loading };
}

function FollowListScreen({ mode = 'user' }) {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: me } = useAuth();

  // mode='me'면 /profile/follows에서 호출 → 내 ID 사용
  const targetUserId = mode === 'me' ? me?.id || null : params.userId || null;

  const initialTab = searchParams.get('tab') === 'following' ? 'following' : 'followers';
  const [tab, setTab] = useState(initialTab);

  const { list, setList, loading } = useFollowList(targetUserId, tab);

  // URL과 탭 동기화
  useEffect(() => {
    if (searchParams.get('tab') !== tab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const headerTitle = useMemo(() => (tab === 'followers' ? '팔로워' : '팔로잉'), [tab]);

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 52,
          padding: '0 12px',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconArrowLeft size={22} color={TEXT_PRIMARY} />
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>
          {headerTitle}
        </span>
      </div>

      {/* 탭 */}
      <div
        className="flex items-stretch"
        style={{ borderBottom: `1px solid ${BORDER_LIGHT}`, background: '#fff' }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1"
              style={{
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: active ? `2px solid ${KEY}` : '2px solid transparent',
                marginBottom: -1,
                color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 리스트 */}
      <div style={{ padding: '8px 12px 24px' }}>
        {loading ? (
          <p className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
            불러오는 중...
          </p>
        ) : list.length === 0 ? (
          <Empty kind={tab} />
        ) : (
          list.map((u) => (
            <FollowRow
              key={u.id}
              user={u}
              onChange={(next) => {
                setList((prev) =>
                  prev.map((x) => (x.id === u.id ? { ...x, is_following: next } : x)),
                );
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FollowRow({ user, onChange }) {
  const navigate = useNavigate();
  const { isFollowing, pending, toggleFollow, canFollow } = useFollow({
    targetUserId: user.id,
    initialFollowing: !!user.is_following,
  });

  const initial = String(user.name || '?').trim().charAt(0).toUpperCase() || '·';
  const avatar = user.avatar_url ? getDisplayImageUrl(user.avatar_url) : '';

  const handleClick = () => {
    if (user.is_me) navigate('/profile');
    else navigate(`/user/${encodeURIComponent(user.id)}`);
  };

  return (
    <div
      className="flex items-center"
      style={{
        gap: 12,
        padding: '10px 6px',
        borderBottom: `1px solid #F2F2F2`,
        cursor: 'pointer',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div
        className="flex items-center justify-center flex-shrink-0 overflow-hidden text-white font-semibold"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: user.avatar_color || KEY,
          fontSize: 16,
        }}
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}
          >
            {user.name}
          </span>
        </div>
        <p
          className="m-0 truncate"
          style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}
        >
          {user.helped_count > 0
            ? `도움 ${user.helped_count}명`
            : user.bio || ' '}
        </p>
      </div>

      {!user.is_me && canFollow && (
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            await toggleFollow();
            onChange && onChange(!isFollowing);
          }}
          disabled={pending}
          className="flex items-center justify-center gap-1"
          style={{
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: pending ? 'not-allowed' : 'pointer',
            border: isFollowing ? `1px solid ${BORDER_LIGHT}` : 'none',
            background: isFollowing ? '#fff' : KEY,
            color: isFollowing ? TEXT_PRIMARY : '#fff',
            flexShrink: 0,
          }}
        >
          {isFollowing ? '팔로잉' : '팔로우'}
        </button>
      )}
    </div>
  );
}

function Empty({ kind }) {
  const primary = kind === 'followers' ? '아직 팔로워가 없어요' : '아직 팔로잉이 없어요';
  const secondary =
    kind === 'followers'
      ? '당신의 한 장이 누군가에게 도움이 되면 팔로워가 늘어나요'
      : '관심 있는 여행자를 팔로우해 보세요';
  return (
    <div className="text-center" style={{ padding: '60px 16px' }}>
      <p className="m-0" style={{ fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 6 }}>
        {primary}
      </p>
      <p className="m-0" style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
        {secondary}
      </p>
    </div>
  );
}

export default FollowListScreen;
