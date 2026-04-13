import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useMatch } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { getEarnedBadgesForUser, getBadgeDisplayName } from '../utils/badgeSystem';
import { getMergedMyPostsForStats, fetchPostsByUserIdSupabase } from '../api/postsSupabase';
import { getPosts } from '../api/posts';
import api from '../api/axios';

const getPostUserId = (post) => {
  let uid = post?.userId;
  if (!uid && typeof post?.user === 'string') uid = post.user;
  if (!uid && post?.user && typeof post.user === 'object') {
    uid = post.user.id || post.user.userId || post.user._id;
  }
  if (!uid) uid = post?.user;
  return uid != null ? String(uid) : '';
};

function sortBadges(badges) {
  if (!Array.isArray(badges)) return [];
  return [...badges].sort((a, b) => {
    const ta = Number(a?.earnedAt) || 0;
    const tb = Number(b?.earnedAt) || 0;
    if (tb !== ta) return tb - ta;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

const EarnedBadgesScreen = () => {
  const navigate = useNavigate();
  const { userId: paramUserId } = useParams();
  const selfMatch = useMatch({ path: '/profile/badges', end: true });
  const { user: authUser } = useAuth();

  const targetUserId = selfMatch ? authUser?.id : paramUserId;
  const isSelf = !!(authUser?.id && targetUserId && String(authUser.id) === String(targetUserId));

  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState([]);
  const [screenTitle, setScreenTitle] = useState('획득한 인장');

  const sortedBadges = useMemo(() => sortBadges(badges), [badges]);

  const loadMergedForUser = useCallback(async (uid) => {
    const byId = new Map();
    const uploaded = JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem('uploadedPosts') || '[]' : '[]');
    const localPosts = (uploaded || []).filter((p) => getPostUserId(p) === String(uid));
    localPosts.forEach((p) => {
      const id = p?.id || p?._id;
      if (id) byId.set(id, p);
    });

    try {
      let remote = await fetchPostsByUserIdSupabase(uid);
      if ((!remote || remote.length === 0) && /^[0-9a-f-]{36}$/i.test(String(uid).trim())) {
        try {
          remote = await getMergedMyPostsForStats(uid);
        } catch {
          remote = [];
        }
      }
      (remote || []).forEach((p) => {
        if (p?.id) byId.set(p.id, { ...byId.get(p.id), ...p });
      });
    } catch {
      /* ignore */
    }

    try {
      const res = await getPosts({ limit: 100 });
      if (res?.posts && Array.isArray(res.posts)) {
        res.posts
          .filter((post) => getPostUserId(post) === String(uid))
          .forEach((apiPost) => {
            const id = apiPost.id || apiPost._id;
            if (!id) return;
            const normalized = {
              ...apiPost,
              id,
              imageUrl: apiPost.imageUrl || apiPost.image || (apiPost.images && apiPost.images[0]),
              images: apiPost.images || (apiPost.imageUrl ? [apiPost.imageUrl] : []),
              createdAt: apiPost.createdAt || apiPost.timestamp,
              timestamp: apiPost.timestamp || apiPost.createdAt,
            };
            if (!byId.has(id)) byId.set(id, normalized);
            else byId.set(id, { ...byId.get(id), ...normalized });
          });
      }
    } catch {
      /* ignore */
    }

    return [...byId.values()].sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));
  }, []);

  useEffect(() => {
    if (!targetUserId) {
      navigate(-1);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const merged = await loadMergedForUser(String(targetUserId));
      if (cancelled) return;
      const list = getEarnedBadgesForUser(String(targetUserId), merged.length ? merged : null) || [];
      setBadges(list);

      if (isSelf) {
        const saved = JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem('user') || '{}' : '{}');
        const name = saved?.username || authUser?.username;
        setScreenTitle(name ? `${name}님의 인장` : '내 인장');
      } else {
        const isServerId = /^[a-fA-F0-9]{24}$/.test(String(targetUserId));
        if (isServerId) {
          try {
            const res = await api.get(`/users/${targetUserId}`);
            const u = res.data?.user;
            if (!cancelled && u?.username) {
              setScreenTitle(`${u.username}님의 인장`);
              return;
            }
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setScreenTitle('획득한 인장');
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selfMatch, targetUserId, isSelf, authUser?.username, navigate, loadMergedForUser]);

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark">
      <div className="screen-content">
        <header className="screen-header bg-white dark:bg-gray-900 flex items-center p-4 gap-3 border-b border-gray-100 dark:border-gray-800">
          <BackButton onClick={() => navigate(-1)} />
          <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold truncate flex-1">
            {screenTitle}
          </h1>
        </header>

        <div className="screen-body bg-white dark:bg-gray-900 px-4 py-6 pb-24">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
            </div>
          ) : sortedBadges.length === 0 ? (
            <p className="text-center text-text-secondary-light dark:text-text-secondary-dark text-sm py-12">
              아직 획득한 인장이 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
              {sortedBadges.map((badge, index) => {
                const label = getBadgeDisplayName(badge) || badge?.name || '인장';
                const icon = badge?.icon;
                return (
                  <div key={`${badge?.name || 'b'}-${index}`} className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-950 border-[3px] border-red-600 dark:border-red-500 flex items-center justify-center shadow-sm overflow-hidden mb-2">
                      {icon ? (
                        <span className="text-3xl leading-none select-none">{icon}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 text-center px-1 leading-tight line-clamp-2">
                          {label.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-center text-gray-900 dark:text-white line-clamp-3 break-keep leading-snug">
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default EarnedBadgesScreen;
