import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import {
  getNotificationsForCurrentUser,
  getNotificationStoredUserId,
  syncNotificationsFromSupabase,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../utils/notifications';
import { follow, unfollow, isFollowing, getFollowingIds, syncFollowingFromSupabase } from '../utils/followSystem';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { fetchFriendNewsStateSupabase, upsertFriendNewsStateSupabase } from '../api/friendNewsSupabase';
import { getBadgeDisplayNameFromName } from '../utils/badgeSystem';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

// 서버 운영 전환: localStorage 제거 → 친구소식 읽음 상태는 Supabase(friend_news_state)로만 동기화

const typeMeta = {
  badge: { icon: 'military_tech', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  like: { icon: 'favorite', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  comment: { icon: 'chat_bubble', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  follow: { icon: 'person', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  post: { icon: 'photo_camera', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  system: { icon: 'notifications', bg: 'bg-zinc-100 dark:bg-zinc-800' },
};

function notificationTimeMs(n) {
  if (n.timestamp) {
    const t = new Date(n.timestamp).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

function bucketLabel(daysAgo) {
  if (daysAgo <= 7) return '최근 7일';
  if (daysAgo <= 30) return '최근 30일';
  return '이전';
}

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showMarkAllReadModal, setShowMarkAllReadModal] = useState(false);
  const [allNotifications, setAllNotifications] = useState([]);
  const [tab, setTab] = useState('all'); // all | friends
  const [friendNews, setFriendNews] = useState([]);
  const [, setTick] = useState(0);
  /** 친구소식 읽음 상태(Supabase와 동기화, 기기 간 공유) */
  const friendNewsStateRef = useRef({ read_map: {}, last_seen_ms: 0 });

  useEffect(() => {
    // Supabase 동기화 — AuthContext가 늦게 올 때도 localStorage user id로 수행
    const uid = user?.id || getNotificationStoredUserId();
    if (uid) {
      syncNotificationsFromSupabase(String(uid)).finally(() => loadNotifications());
    } else {
      loadNotifications();
    }
    const handleNotificationUpdate = () => loadNotifications();
    window.addEventListener('notificationUpdate', handleNotificationUpdate);
    return () => window.removeEventListener('notificationUpdate', handleNotificationUpdate);
  }, [user?.id]);

  const loadNotifications = () => {
    setAllNotifications(getNotificationsForCurrentUser());
  };

  const loadFriendNews = useCallback(async () => {
    try {
      const uid = String(user?.id || getNotificationStoredUserId() || '').trim();
      if (!uid) {
        setFriendNews([]);
        friendNewsStateRef.current = { read_map: {}, last_seen_ms: 0 };
        return;
      }
      await syncFollowingFromSupabase(uid);
      const followingIds = getFollowingIds(uid);
      if (!Array.isArray(followingIds) || followingIds.length === 0) {
        setFriendNews([]);
        friendNewsStateRef.current = { read_map: {}, last_seen_ms: 0 };
        return;
      }

      const [rows, remoteState] = await Promise.all([
        fetchPostsSupabase(),
        isValidUuid(uid) ? fetchFriendNewsStateSupabase(uid) : Promise.resolve({ last_seen_ms: 0, read_map: {} }),
      ]);

      let lastSeen = Number(remoteState.last_seen_ms) || 0;
      let readMap =
        remoteState.read_map && typeof remoteState.read_map === 'object' && !Array.isArray(remoteState.read_map)
          ? { ...remoteState.read_map }
          : {};

      if (isValidUuid(uid)) {
        // localStorage 기반 폴백 제거 (Supabase 상태만 사용)
      }

      friendNewsStateRef.current = { read_map: readMap, last_seen_ms: lastSeen };

      const followingSet = new Set(followingIds.map(String));

      const items = (rows || [])
        .filter((p) => followingSet.has(String(p.userId || p.user?.id || '')))
        .map((p) => {
          const pid = String(p.id);
          const ts = Number(p.timestamp || 0) || (p.createdAt ? new Date(p.createdAt).getTime() : 0) || Date.now();
          const author = p.user && typeof p.user === 'object' ? (p.user.username || '') : '';
          const who = String(author || p.author_username || '여행자');
          const thumb = getDisplayImageUrl(p.thumbnail || (Array.isArray(p.images) ? p.images[0] : ''));
          const id = `friendpost:${pid}`;
          const isRead = !!(readMap && readMap[id]);
          return {
            id,
            type: 'post',
            read: isRead,
            time: '',
            timestamp: new Date(ts).toISOString(),
            message: `${who}님이 새 게시물을 올렸습니다.`,
            subMessage: String(p.placeName || p.location || p.region || '').trim() || null,
            actorUsername: who,
            actorAvatar: p.user && typeof p.user === 'object' ? (p.user.profileImage || null) : null,
            actorUserId: String(p.userId || p.user?.id || ''),
            thumbnailUrl: thumb || null,
            postId: pid,
            link: `/post/${pid}`,
            __ts: ts,
            __new: ts > lastSeen,
          };
        })
        .sort((a, b) => (b.__ts || 0) - (a.__ts || 0))
        .slice(0, 100);

      setFriendNews(items);
    } catch {
      setFriendNews([]);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadFriendNews();
    const onFollows = () => void loadFriendNews();
    window.addEventListener('followsUpdated', onFollows);
    return () => window.removeEventListener('followsUpdated', onFollows);
  }, [loadFriendNews]);

  const list = useMemo(() => {
    const base = tab === 'friends' ? friendNews : allNotifications;
    const filtered =
      tab === 'friends'
        ? base
        : (base || []).filter((n) => {
            // 전체 소식에서는 "게시물 업데이트" 류 알림은 숨김
            if (n?.type === 'post') return false;
            if (String(n?.data?.kind || '').includes('post')) return false;
            if (/게시물.*업데이트/i.test(String(n?.message || ''))) return false;
            return true;
          });
    return [...filtered].sort((a, b) => notificationTimeMs(b) - notificationTimeMs(a));
  }, [allNotifications, friendNews, tab]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const groups = { '최근 7일': [], '최근 30일': [], 이전: [] };
    list.forEach((n) => {
      const ms = notificationTimeMs(n);
      const days = (now - ms) / 86400000;
      const key = bucketLabel(days);
      if (groups[key]) groups[key].push(n);
      else groups.이전.push(n);
    });
    return groups;
  }, [list]);

  const handleOpen = (notification) => {
    if (tab === 'friends') {
      const uid = String(user?.id || getNotificationStoredUserId() || '').trim();
      const id = String(notification.id);
      const now = Date.now();

      if (isValidUuid(uid)) {
        const prev = friendNewsStateRef.current;
        const nextRead = { ...prev.read_map, [id]: true };
        const nextLast = now;
        friendNewsStateRef.current = { read_map: nextRead, last_seen_ms: nextLast };
        void upsertFriendNewsStateSupabase(uid, { read_map: nextRead, last_seen_ms: nextLast });
      }
      setFriendNews((prev) => prev.map((x) => (x.id === notification.id ? { ...x, read: true, __new: false } : x)));
    }
    if (tab !== 'friends' && !notification.read) {
      markNotificationAsRead(notification.id);
      loadNotifications();
    }
    if (notification.data?.type === 'sos_request' && notification.data.sosRequest) {
      navigate('/map');
      return;
    }
    // 좋아요/댓글 등 상호작용 알림은 "게시물"이 아니라 "상호작용한 사용자" 프로필로 이동
    if (tab !== 'friends' && (notification.type === 'like' || notification.type === 'comment' || notification.type === 'follow')) {
      const actorId = String(notification.actorUserId || '').trim();
      if (actorId) {
        const selfId = String(user?.id || getNotificationStoredUserId() || '').trim();
        if (selfId && actorId === selfId) {
          navigate('/profile');
        } else {
          navigate(`/user/${encodeURIComponent(actorId)}`);
        }
        return;
      }
    }
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = () => {
    if (tab === 'friends') {
      const uid = String(user?.id || getNotificationStoredUserId() || '').trim();
      const now = Date.now();

      if (isValidUuid(uid)) {
        const prev = friendNewsStateRef.current;
        const nextRead = { ...prev.read_map };
        friendNews.forEach((n) => {
          nextRead[String(n.id)] = true;
        });
        friendNewsStateRef.current = { read_map: nextRead, last_seen_ms: now };
        void upsertFriendNewsStateSupabase(uid, { read_map: nextRead, last_seen_ms: now });
      }
      setFriendNews((prev) => prev.map((x) => ({ ...x, read: true, __new: false })));
    } else {
      markAllNotificationsAsRead();
      loadNotifications();
    }
    setShowMarkAllReadModal(false);
    window.dispatchEvent(new Event('notificationCountChanged'));
  };

  const getBadgeDisplayFromMessage = (msg) => {
    const m = String(msg || '');
    if (!m) return '';
    // 1) dyn:... 토큰
    const dyn = m.match(/(dyn:[^\s"']+)/);
    if (dyn && dyn[1]) {
      try {
        return getBadgeDisplayNameFromName(String(dyn[1]).trim());
      } catch {
        return String(dyn[1]).trim();
      }
    }
    // 2) "뱃지명"
    const q = m.match(/"([^"]+)"/);
    if (q && q[1]) return String(q[1]).trim();
    // 3) 문장 끝 패턴 제거
    if (m.includes('뱃지')) {
      const stripped = m.replace(/\s*뱃지를\s*획득했습니다[!！]?\s*$/u, '').trim();
      return stripped.replace(/^["「『]|["」』]$/g, '').trim();
    }
    return '';
  };

  const avatarFor = (n) => {
    if (n.actorAvatar) return getDisplayImageUrl(n.actorAvatar);
    return null;
  };

  const leftIcon = (n) => {
    const t = typeMeta[n.type] || typeMeta.system;
    const url = avatarFor(n);
    if (url && (n.type === 'follow' || n.type === 'like')) {
      return (
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:ring-zinc-600">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      );
    }
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.bg}`}
      >
        <span className="material-symbols-outlined text-[20px] text-zinc-500 dark:text-zinc-400">
          {n.icon || t.icon}
        </span>
      </div>
    );
  };

  const renderRight = (n) => {
    if (n.type === 'like' && n.thumbnailUrl) {
      return (
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-600">
          <img src={getDisplayImageUrl(n.thumbnailUrl)} alt="" className="h-full w-full object-cover" />
        </div>
      );
    }
    if (n.type === 'badge' || n.type === 'system') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpen({ ...n, read: n.read });
          }}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:border-primary/30 hover:text-primary-dark dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-primary/40"
        >
          자세히
        </button>
      );
    }
    if (n.type === 'follow' && n.kind === 'follow_received' && n.actorUserId) {
      const uid = n.actorUserId;
      const following = isFollowing(null, uid);
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (following) {
              unfollow(uid);
            } else {
              follow(uid);
            }
            setTick((x) => x + 1);
            window.dispatchEvent(new CustomEvent('followsUpdated'));
          }}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
            following
              ? 'border border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
              : 'bg-primary text-white shadow-sm hover:bg-primary-dark'
          }`}
        >
          {following ? '팔로잉' : '팔로우'}
        </button>
      );
    }
    return null;
  };

  const mainText = (n) => {
    if (n.type === 'badge') {
      const raw = n.badge || '';
      const display =
        n.badgeDisplayName ||
        (raw ? getBadgeDisplayNameFromName(raw) : '') ||
        getBadgeDisplayFromMessage(n.message);
      if (display) return `"${display}" 뱃지를 획득했습니다!`;
      if (n.message) return n.message;
      return '뱃지를 획득했습니다';
    }
    if (n.message) return n.message;
    return n.title || '알림';
  };

  const sectionOrder = ['최근 7일', '최근 30일', '이전'];

  return (
    <div className="screen-layout relative h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <div className="screen-content">
        <header className="screen-header flex h-14 items-center justify-between border-b border-border-light bg-white px-3 dark:border-border-dark dark:bg-gray-900">
          <button
            type="button"
            onClick={() => navigate('/main')}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            알림
          </h1>
          <button
            type="button"
            onClick={() => setShowMarkAllReadModal(true)}
            disabled={(tab === 'friends' ? friendNews : allNotifications).filter((x) => !x.read).length === 0}
            className="flex size-11 shrink-0 items-center justify-end rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <span className="material-symbols-outlined text-[22px]">done</span>
          </button>
        </header>

        <div className="bg-white px-3 pt-2 dark:bg-gray-900">
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                tab === 'all' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setTab('friends')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                tab === 'friends' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              친구소식
            </button>
          </div>
        </div>

        <div className="screen-body">
          <div className="pb-24 pt-1">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20">
                <span className="material-symbols-outlined mb-3 text-5xl text-zinc-300 dark:text-zinc-600">
                  notifications_off
                </span>
                <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                  알림이 없습니다
                </p>
                <p className="mt-1 text-center text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  활동이 쌓이면 여기에 표시돼요
                </p>
              </div>
            ) : (
              <div className="px-0">
                {sectionOrder.map((section) => {
                  const items = grouped[section];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={section} className="mb-4">
                      <p className="px-4 pb-2 pt-3 text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
                        {section}
                      </p>
                      <div className="divide-y divide-border-light bg-white dark:divide-border-dark dark:bg-gray-900">
                        {items.map((notification) => (
                          <div
                            key={notification.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpen(notification)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') handleOpen(notification);
                            }}
                            className={`flex cursor-pointer items-center gap-2.5 border-l-[3px] px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80 ${
                              !notification.read
                                ? 'border-primary bg-zinc-50/70 dark:border-primary dark:bg-zinc-800/50'
                                : 'border-transparent'
                            }`}
                          >
                            {leftIcon(notification)}
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] leading-snug text-text-primary-light dark:text-text-primary-dark">
                                {mainText(notification)}
                              </p>
                              {notification.subMessage ? (
                                <p className="mt-0.5 line-clamp-1 text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                                  {notification.subMessage}
                                </p>
                              ) : null}
                              <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                                {notification.time}
                              </p>
                            </div>
                            {renderRight(notification)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation />

      {showMarkAllReadModal && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-light bg-white shadow-2xl dark:border-border-dark dark:bg-gray-900">
            <div className="p-5">
              <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                모든 알림을 읽음 처리할까요?
              </h3>
              <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                읽지 않은 알림 {(tab === 'friends' ? friendNews : allNotifications).filter((n) => !n.read).length}개가 읽음
                처리됩니다.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowMarkAllReadModal(false)}
                className="flex-1 rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsScreen;
