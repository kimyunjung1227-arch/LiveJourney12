import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useMatch, useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { getEarnedBadgesForUser, getBadgeDisplayName } from '../utils/badgeSystem';
import LiveBadgeMedallion from '../components/LiveBadgeMedallion';

function sortBadges(badges) {
  if (!Array.isArray(badges)) return [];
  return [...badges].sort((a, b) => {
    const ta = Number(a?.earnedAt) || 0;
    const tb = Number(b?.earnedAt) || 0;
    if (tb !== ta) return tb - ta;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

const BADGE_SECTIONS = [
  {
    key: 'region',
    title: '지역 인장',
    description: '특정 지역의 실시간 정보를 꾸준히 올리면 성장하는 인장이에요.',
    matches: (b) =>
      String(b?.name || '').startsWith('dyn:region:') || String(b?.category || '').includes('지역'),
  },
  {
    key: 'nature',
    title: '자연·풍경',
    description: '개화 상태와 절경 컨디션을 공유하며 성장하는 인장이에요.',
    matches: (b) => b?.category === '자연·풍경',
  },
  {
    key: 'hotplace',
    title: '명소·핫플',
    description: '랜드마크와 맛집·카페의 인파·대기 정보를 정복하는 인장이에요.',
    matches: (b) => b?.category === '명소·핫플',
  },
  {
    key: 'hidden',
    title: '숨은 명소',
    description: '미등록 장소를 발굴하고 기록하는 모험형 인장이에요.',
    matches: (b) => b?.category === '숨은 명소',
  },
  {
    key: 'night',
    title: '심야 가이드',
    description: '늦은 밤과 야경의 실시간 상황을 전하는 특수 인장이에요.',
    matches: (b) => b?.category === '심야 가이드',
  },
  {
    key: 'support',
    title: '여행 응원',
    description: '커뮤니티에 도움을 주며 성장하는 인장이에요.',
    matches: (b) => b?.category === '여행 응원',
  },
];

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
  const [profileName, setProfileName] = useState('사용자');
  const [profileImage, setProfileImage] = useState(null);

  const sortedBadges = useMemo(() => sortBadges(badges), [badges]);
  const badgeSections = useMemo(
    () =>
      BADGE_SECTIONS.map((section) => ({
        ...section,
        items: sortedBadges.filter(section.matches),
      })).filter((section) => section.items.length > 0),
    [sortedBadges]
  );

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
          setProfileName(name || '나');
          setProfileImage(authUser?.profileImage || null);
        } else {
          const hint = location.state?.profileHint || null;
          const name = hint?.username || '사용자';
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
            뱃지 모아보기
          </h1>
        </header>

        <div className="screen-body bg-white dark:bg-gray-900 px-4 py-6 pb-24">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                  {profileImage ? (
                    <img src={profileImage} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark truncate">
                    {profileName || '사용자'}
                  </span>
                </div>
              </div>

              {sortedBadges.length === 0 ? (
                <p className="text-center text-text-secondary-light dark:text-text-secondary-dark text-sm py-12">
                  아직 획득한 뱃지가 없습니다.
                </p>
              ) : (
                <div className="space-y-10">
                  {badgeSections.map((section) => (
                    <section key={section.key}>
                      <h2 className="text-sm font-extrabold text-text-primary-light dark:text-text-primary-dark mb-1">
                        {section.title}
                      </h2>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-4">
                        {section.description}
                      </p>
                      <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
                        {section.items.map((badge, index) => {
                          const label = getBadgeDisplayName(badge) || badge?.name || '뱃지';
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
                              <LiveBadgeMedallion
                                badgeName={badge?.name}
                                tier={badge?.difficulty}
                                icon={icon}
                                gradientCss={badge?.gradientCss}
                                size={64}
                                className="mb-2"
                              />
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
                    </section>
                  ))}
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
