import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useMatch, useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { getEarnedBadgesForUser, getBadgeDisplayName } from '../utils/badgeSystem';
 

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
  const location = useLocation();
  const { userId: paramUserId } = useParams();
  const selfMatch = useMatch({ path: '/profile/badges', end: true });
  const { user: authUser } = useAuth();

  const targetUserId = selfMatch ? authUser?.id : paramUserId;
  const isSelf = !!(authUser?.id && targetUserId && String(authUser.id) === String(targetUserId));

  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState([]);
  const [screenTitle, setScreenTitle] = useState('획득한 라이브뱃지');
  const [profileName, setProfileName] = useState('사용자');
  const [profileImage, setProfileImage] = useState(null);

  const setRepresentativeBadge = useCallback((badge) => {
    if (!badge) return;
    // 서버 운영 전환: 대표 뱃지는 Supabase(user_badges / profile) 기준으로만 유지
    void badge;
  }, [authUser?.id]);

  const sortedBadges = useMemo(() => sortBadges(badges), [badges]);
  const groupedBadges = useMemo(() => {
    const isRegion = (b) =>
      String(b?.name || '').startsWith('dyn:region:') || String(b?.category || '').includes('지역');
    const isTheme = (b) => !isRegion(b); // 시즌/가치 등
    const regionBadges = sortedBadges.filter(isRegion);
    const themeBadges = sortedBadges.filter(isTheme);
    return { regionBadges, themeBadges };
  }, [sortedBadges]);

  const loadLocalPostsForUser = useCallback((uid) => {
    try {
      void uid;
      return [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!targetUserId) {
      navigate(-1);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const uid = String(targetUserId);
        const passedBadges = location.state?.badges;
        if (Array.isArray(passedBadges)) {
          setBadges(passedBadges);
        } else {
          const localPosts = loadLocalPostsForUser(uid);
        if (cancelled) return;
          const list = getEarnedBadgesForUser(uid, localPosts.length ? localPosts : null) || [];
          setBadges(list);
        }

        if (isSelf) {
          const name = authUser?.username || '나';
          setScreenTitle(name ? `${name}님의 라이브뱃지` : '내 라이브뱃지');
          setProfileName(name || '나');
          setProfileImage(authUser?.profileImage || null);
        } else {
          const hint = location.state?.profileHint || null;
          const name = hint?.username || '사용자';
          setScreenTitle(`${name}님의 라이브뱃지`);
          setProfileName(name);
          setProfileImage(hint?.profileImage || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selfMatch, targetUserId, isSelf, authUser?.username, authUser?.profileImage, navigate, loadLocalPostsForUser, location.state]);

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark">
      <div className="screen-content">
        <header className="screen-header bg-white dark:bg-gray-900 flex items-center p-4 gap-3 border-b border-gray-100 dark:border-gray-800">
          <BackButton onClick={() => navigate(-1)} />
          <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold truncate flex-1">
            라이브뱃지 모아보기
          </h1>
        </header>

        <div className="screen-body bg-white dark:bg-gray-900 px-4 py-6 pb-24">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
            </div>
          ) : (
            <>
              {/* 프로필 정보 */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                  {profileImage ? (
                    <img src={profileImage} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark truncate">
                      {profileName || '사용자'}
                    </span>
                  </div>
                </div>
              </div>

              {sortedBadges.length === 0 ? (
                <p className="text-center text-text-secondary-light dark:text-text-secondary-dark text-sm py-12">
                  아직 획득한 라이브뱃지가 없습니다.
                </p>
              ) : (
                <div className="space-y-10">
                  <section>
                    <h2 className="text-sm font-extrabold text-text-primary-light dark:text-text-primary-dark mb-1">
                      지역 인장
                    </h2>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-4">
                      특정 지역의 실시간 정보를 꾸준히 올리면 성장하는 인장이에요.
                    </p>
                    {groupedBadges.regionBadges.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/20 px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        인장이 없습니다.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
                        {groupedBadges.regionBadges.map((badge, index) => {
                          const label = getBadgeDisplayName(badge) || badge?.name || '라이브뱃지';
                          const icon = badge?.icon;
                          return (
                            <button
                              key={`${badge?.name || 'b'}-${index}`}
                              type="button"
                              onClick={() =>
                                navigate(`/badge/live/${encodeURIComponent(String(badge?.name || ''))}`, {
                                  state: { badge },
                                })
                              }
                              className="flex flex-col items-center text-left"
                            >
                              <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-950 border-[3px] border-primary flex items-center justify-center shadow-sm overflow-hidden mb-2">
                                {icon ? (
                                  <span className="text-3xl leading-none select-none">{icon}</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-primary text-center px-1 leading-tight line-clamp-2">
                                    {label.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[11px] font-semibold text-center px-2 py-1 rounded-full border bg-primary/10 dark:bg-primary/15 border-primary/25 text-primary truncate w-full"
                                title={label}
                              >
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section>
                    <h2 className="text-sm font-extrabold text-text-primary-light dark:text-text-primary-dark mb-1">
                      테마 인장
                    </h2>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-4">
                      시즌/가치 테마 활동으로 성장하는 인장이에요.
                    </p>
                    {groupedBadges.themeBadges.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/20 px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        인장이 없습니다.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
                        {groupedBadges.themeBadges.map((badge, index) => {
                          const label = getBadgeDisplayName(badge) || badge?.name || '라이브뱃지';
                          const icon = badge?.icon;
                          return (
                            <button
                              key={`${badge?.name || 'b'}-${index}`}
                              type="button"
                              onClick={() =>
                                navigate(`/badge/live/${encodeURIComponent(String(badge?.name || ''))}`, {
                                  state: { badge },
                                })
                              }
                              className="flex flex-col items-center text-left"
                            >
                              <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-950 border-[3px] border-primary flex items-center justify-center shadow-sm overflow-hidden mb-2">
                                {icon ? (
                                  <span className="text-3xl leading-none select-none">{icon}</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-primary text-center px-1 leading-tight line-clamp-2">
                                    {label.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[11px] font-semibold text-center px-2 py-1 rounded-full border bg-primary/10 dark:bg-primary/15 border-primary/25 text-primary truncate w-full"
                                title={label}
                              >
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default EarnedBadgesScreen;
