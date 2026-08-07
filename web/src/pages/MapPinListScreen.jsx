import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import FastImage from '../components/FastImage';
import StatusBadge from '../components/StatusBadge';
import { supabase } from '../utils/supabaseClient';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getWeatherByCoords } from '../api/weather';
import { logger } from '../utils/logger';
import { LJ, categoryLabel } from '../components/lj/tokens';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import { normalizePostsForFeed } from '../utils/postNormalize';
import { combinePostsSupabaseAndLocal } from '../utils/mergePostsById';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
import { getValidWeatherSnapshot } from '../utils/weatherSnapshot';
import { getPhotoStatusFromPost } from '../utils/photoStatus';
import { MAIN_FEED_IMAGE_OPTS } from '../utils/mainFeedSnapshot';
import {
  SCREEN_GRID_EAGER_COUNT,
  SCREEN_IMAGE_HIGH_PRIORITY_COUNT,
} from '../utils/imgAttrs';
import {
  feedGridCardBoxFlat,
  feedGridImageBoxFlat,
  feedGridInfoBox,
  feedGridTitleStyle,
  feedGridDescStyle,
  feedGridMetaRow,
} from '../utils/feedGridCardStyles';
import { useAuth } from '../contexts/AuthContext';

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '방금';
  const min = Math.floor(ms / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

/**
 * 지도에서 "목록보기"로 들어오는 화면.
 * 지도가 넘겨준 뷰포트(bounds)·카테고리로 get_map_bundles 를 다시 불러
 * 보고 있던 지도의 핀들을 "지금 여기는" 피드와 같은 2열 그리드로 보여준다.
 * 뷰포트에 핀이 하나도 없으면 지금 올라온 라이브 피드로 대체해서 채운다.
 */
const MapPinListScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const contentRef = useRef(null);

  const bounds = location.state?.bounds || null;
  const center = location.state?.center || null;
  const category = location.state?.category || 'all';
  const regionLabel = String(location.state?.regionLabel || '').trim();

  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [livePosts, setLivePosts] = useState([]);

  // 지도 상태 없이 직접 들어온 경우(새로고침 등) → 지도로 되돌림
  useEffect(() => {
    if (!bounds) navigate('/map', { replace: true });
  }, [bounds, navigate]);

  // 보고 있던 뷰포트의 묶음 다시 조회
  useEffect(() => {
    if (!bounds) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_map_bundles', {
          p_sw_lat: bounds.sw.lat,
          p_sw_lng: bounds.sw.lng,
          p_ne_lat: bounds.ne.lat,
          p_ne_lng: bounds.ne.lng,
          p_category: category === 'all' ? null : category,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_map_bundles 실패', error?.message || error);
          setBundles([]);
        } else {
          setBundles(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) {
          logger.warn('get_map_bundles 예외', e?.message || e);
          setBundles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bounds, category]);

  const hasPins = bundles.length > 0;
  const usingLiveFallback = !loading && !hasPins;

  // 주변에 핀이 없으면 지금 올라온 라이브 피드로 채운다
  useEffect(() => {
    if (!usingLiveFallback) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const localPosts = getUploadedPostsSafe();
        const supabasePosts = await fetchPostsSupabase(user?.id || null);
        if (cancelled) return;
        const all = normalizePostsForFeed(
          combinePostsSupabaseAndLocal(supabasePosts, localPosts),
        );
        setLivePosts(filterActivePosts48(all));
      } catch (e) {
        if (!cancelled) {
          logger.warn('라이브 피드 폴백 실패', e?.message || e);
          setLivePosts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usingLiveFallback, user?.id]);

  // 지도 중심의 실시간 기온
  useEffect(() => {
    if (!center) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await getWeatherByCoords(center.lat, center.lng);
        if (!cancelled) setWeather(res?.success ? res.weather : null);
      } catch {
        if (!cancelled) setWeather(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [center]);

  // 실시간성 우선 — 최신 촬영 순
  const sortedBundles = useMemo(() => {
    const list = [...bundles];
    list.sort(
      (a, b) =>
        (new Date(b.primary_taken_at || 0).getTime() || 0) -
        (new Date(a.primary_taken_at || 0).getTime() || 0),
    );
    return list;
  }, [bundles]);

  const totalPhotos = useMemo(
    () =>
      sortedBundles.reduce(
        (sum, b) => sum + Math.max(1, Number(b.bundle_count) || 1),
        0,
      ),
    [sortedBundles],
  );

  // 핀 / 라이브 피드를 같은 카드 모양으로 통일
  const cards = useMemo(() => {
    if (hasPins) {
      return sortedBundles.map((b) => {
        const count = Math.max(1, Number(b.bundle_count) || 1);
        const label = b.category ? categoryLabel(b.category) : '';
        return {
          key: String(b.bundle_id),
          rawImage: b.primary_thumbnail || '',
          title: b.place_name || '어딘가의 지금',
          desc: b.body || '',
          timeLabel: timeAgo(b.primary_taken_at),
          metaRight: label ? <span>{label}</span> : null,
          count,
          status: 'NONE',
          onClick: () =>
            navigate(
              `/post/${encodeURIComponent(b.primary_post_id)}${
                b.is_bundle
                  ? `?bundle=${encodeURIComponent(b.bundle_id)}`
                  : ''
              }`,
            ),
        };
      });
    }
    return livePosts.map((post, idx) => {
      const rawImage =
        (Array.isArray(post.images) && post.images.length > 0
          ? post.images[0]
          : post.image || post.thumbnail || '') || '';
      const snap = getValidWeatherSnapshot(post);
      const w = snap || post.weatherSnapshot || post.weather || null;
      const hasWeather = w && (w.icon || w.temperature);
      return {
        key: `${post.id}-${idx}`,
        rawImage,
        title: post.location || '어딘가의 지금',
        desc: post.note || post.content || '',
        timeLabel:
          post.timeLabel ||
          getTimeAgo(
            post.photoDate ||
              post.exifData?.photoDate ||
              post.timestamp ||
              post.createdAt ||
              post.time,
          ),
        metaRight: hasWeather ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {w.icon && <span>{w.icon}</span>}
            {w.temperature && <span>{w.temperature}</span>}
          </span>
        ) : null,
        count: 1,
        status: getPhotoStatusFromPost(post),
        onClick: () =>
          navigate(`/post/${post.id}`, {
            state: {
              post,
              allPosts: livePosts,
              currentPostIndex: idx,
            },
          }),
      };
    });
  }, [hasPins, sortedBundles, livePosts, navigate]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/map', { replace: true });
  }, [navigate]);

  const headerTitle = regionLabel || '지도에서 보이는 지금';

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col relative">
      <header className="screen-header sticky top-0 z-[100] flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-background-light px-4 py-2.5 dark:border-border-dark dark:bg-background-dark">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로가기"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: '#333', fontSize: 24 }}
          >
            arrow_back
          </span>
        </button>

        <div className="flex flex-1 min-w-0 items-center justify-center gap-1.5">
          <span className="truncate text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
            {headerTitle}
          </span>
          {weather?.temperature && weather.temperature !== '-' && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                background: LJ.keyBgLight,
                color: LJ.keyTextDark,
                fontSize: 12,
                fontWeight: 700,
              }}
              title={weather.condition}
            >
              {weather.icon && (
                <span style={{ fontSize: 13, lineHeight: 1 }}>
                  {weather.icon}
                </span>
              )}
              {weather.temperature}
            </span>
          )}
        </div>

        <div className="w-10 shrink-0" aria-hidden />
      </header>

      <div
        ref={contentRef}
        className="screen-content flex-1 overflow-auto bg-background-light px-4 pb-24 pt-3 dark:bg-background-dark"
      >
        {/* 섹션 타이틀 */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2
            className="m-0 text-[15px] font-bold"
            style={{ color: LJ.textPrimary }}
          >
            {hasPins ? '지도에 보이는 지금' : '지금 올라온 라이브'}
          </h2>
          {hasPins && (
            <span
              className="shrink-0 text-[12px] font-semibold"
              style={{ color: LJ.textSecondary }}
            >
              {totalPhotos}장 · {sortedBundles.length}곳
            </span>
          )}
        </div>

        {/* 핀이 없어 라이브 피드로 대체했음을 알림 */}
        {usingLiveFallback && (
          <div
            className="mb-3 flex items-start gap-2 rounded-2xl px-3 py-2.5"
            style={{ background: LJ.keyBgLight }}
          >
            <span
              className="material-symbols-outlined shrink-0"
              style={{ fontSize: 17, color: LJ.keyTextDark }}
              aria-hidden
            >
              near_me
            </span>
            <p
              className="m-0 text-[12px] leading-snug"
              style={{ color: LJ.keyTextDark }}
            >
              이 지도 주변엔 아직 올라온 사진이 없어서, 지금 올라온 라이브를
              보여드려요
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span
              className="animate-spin rounded-full"
              style={{
                width: 24,
                height: 24,
                border: `2px solid ${LJ.key}`,
                borderTopColor: 'transparent',
              }}
            />
          </div>
        ) : cards.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">
              아직 올라온 지금이 없어요
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              방금 본 풍경을 올리면 여기에 바로 보여요
            </p>
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="mt-4 bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold text-sm hover:bg-primary/15 transition-colors"
            >
              업로드 하기
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              rowGap: '7px',
              columnGap: '7px',
              paddingBottom: '16px',
            }}
          >
            {cards.map((card, index) => (
              <div
                key={card.key}
                onClick={card.onClick}
                style={{
                  ...feedGridCardBoxFlat,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={feedGridImageBoxFlat}>
                  {card.rawImage ? (
                    <FastImage
                      rawUrl={card.rawImage}
                      opts={MAIN_FEED_IMAGE_OPTS}
                      alt={card.title}
                      loading={
                        index < SCREEN_GRID_EAGER_COUNT ? 'eager' : 'lazy'
                      }
                      decoding="async"
                      fetchPriority={
                        index < SCREEN_IMAGE_HIGH_PRIORITY_COUNT
                          ? 'high'
                          : 'auto'
                      }
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#cbd5e1',
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '22px' }}
                      >
                        image
                      </span>
                    </div>
                  )}
                  {card.status && card.status !== 'NONE' && (
                    <div
                      style={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }}
                    >
                      <StatusBadge status={card.status} />
                    </div>
                  )}
                  {card.count > 1 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 3,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 8,
                        padding: '2px 7px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {card.count}
                    </span>
                  )}
                </div>

                <div style={feedGridInfoBox}>
                  <div style={feedGridTitleStyle}>{card.title}</div>
                  {card.desc && <div style={feedGridDescStyle}>{card.desc}</div>}
                  <div style={feedGridMetaRow}>
                    <span>{card.timeLabel}</span>
                    {card.metaRight}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (contentRef.current) {
            contentRef.current.scrollTop = 0;
            if (typeof contentRef.current.scrollTo === 'function') {
              contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        style={{
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 20px)',
          right: 'calc((100vw - 460px) / 2 + 20px)',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(148,163,184,0.5)',
          boxShadow: '0 4px 14px rgba(15,23,42,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 200,
        }}
        aria-label="위로가기"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '22px', color: '#111827' }}
        >
          north
        </span>
      </button>

      <BottomNavigation />
    </div>
  );
};

export default MapPinListScreen;
