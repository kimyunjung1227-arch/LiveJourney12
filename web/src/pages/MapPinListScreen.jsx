import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';
import BottomNavigation from '../components/BottomNavigation';
import { supabase } from '../utils/supabaseClient';
import { getDisplayImageUrl } from '../api/upload';
import { getWeatherByCoords } from '../api/weather';
import { logger } from '../utils/logger';
import {
  feedGridCardBoxFlat,
  feedGridImageBoxRegion,
} from '../utils/feedGridCardStyles';
import { SCREEN_IMAGE_HIGH_PRIORITY_COUNT } from '../utils/imgAttrs';

const KEY = '#4DB8E8';

const CATEGORY_META = {
  nature: { Icon: IconFlower, label: '개화·자연' },
  weather: { Icon: IconCloud, label: '날씨·체감' },
  event: { Icon: IconCalendarEvent, label: '이벤트·축제' },
  crowd: { Icon: IconUsers, label: '혼잡도·대기' },
  sunset: { Icon: IconMoon, label: '노을·야경' },
  business: { Icon: IconBuildingStore, label: '영업·운영' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '방금';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

/**
 * 지도에서 "목록보기"로 들어오는 화면.
 * 지도 화면이 넘겨준 뷰포트(bounds)·카테고리로 같은 RPC(get_map_bundles)를 다시 불러
 * 사용자가 보고 있던 지도의 핀들을 지역 상세 화면과 같은 톤의 2열 그리드로 보여준다.
 */
const MapPinListScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const bounds = location.state?.bounds || null;
  const center = location.state?.center || null;
  const category = location.state?.category || 'all';
  const regionLabel = String(location.state?.regionLabel || '').trim();

  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);

  const headerTitle = regionLabel || '지도에서 보이는 지금';

  // 지도 상태 없이 직접 들어온 경우 (새로고침 등) → 지도로 되돌림
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
  const sorted = useMemo(() => {
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
      sorted.reduce(
        (sum, b) => sum + Math.max(1, Number(b.bundle_count) || 1),
        0,
      ),
    [sorted],
  );

  const handleBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/map', { replace: true });
  }, [navigate]);

  return (
    <div className="screen-layout bg-white dark:bg-background-dark relative h-screen overflow-hidden">
      <div className="screen-content relative bg-white dark:bg-background-dark">
        <header
          className="flex flex-col sticky top-0 z-[100] shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center justify-between px-3 py-3 pb-1 bg-white dark:bg-background-dark">
            <button
              type="button"
              onClick={handleBack}
              className="flex size-12 shrink-0 items-center justify-center text-black dark:text-white rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-black/20 transition-colors cursor-pointer touch-manipulation"
              aria-label="뒤로가기"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="material-symbols-outlined text-2xl">
                arrow_back
              </span>
            </button>
            <div className="flex-1 min-w-0 flex items-center justify-center gap-2 px-1">
              <h1 className="min-w-0 text-base font-bold leading-tight tracking-[-0.01em] text-black dark:text-white line-clamp-2">
                {headerTitle}
              </h1>
              {weather?.temperature && weather.temperature !== '-' && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                  }}
                  title={weather.condition}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>
                    {weather.icon}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {weather.temperature}
                  </span>
                </span>
              )}
            </div>
            <div className="size-11 shrink-0" aria-hidden />
          </div>
        </header>

        <div className="screen-body relative z-10 bg-background-light dark:bg-background-dark rounded-t-[18px]">
          <main>
            <div className="flex items-center justify-between px-4 pb-1 pt-4">
              <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-text-headings dark:text-gray-100">
                지도에 보이는 실시간 사진
              </h2>
              {!loading && sorted.length > 0 && (
                <span className="shrink-0 text-[12px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  {totalPhotos}장 · {sorted.length}곳
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <span
                  className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent"
                  style={{ borderColor: `${KEY} transparent ${KEY} ${KEY}` }}
                />
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200 mb-2 text-center">
                  이 지도 범위에 올라온 지금이 없어요
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                  지도를 넓히거나 다른 지역을 둘러보세요
                </p>
                <button
                  onClick={handleBack}
                  className="bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold text-sm hover:bg-primary/15 transition-colors mx-auto"
                >
                  지도로 돌아가기
                </button>
              </div>
            ) : (
              <div className="px-4 pb-3">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    rowGap: '7px',
                    columnGap: '7px',
                  }}
                >
                  {sorted.map((b, idx) => {
                    const cat = CATEGORY_META[b.category];
                    const CatIcon = cat?.Icon;
                    const count = Math.max(1, Number(b.bundle_count) || 1);
                    const cover = b.primary_thumbnail
                      ? getDisplayImageUrl(b.primary_thumbnail)
                      : '';
                    return (
                      <div
                        key={b.bundle_id}
                        onClick={() =>
                          navigate(
                            `/post/${encodeURIComponent(b.primary_post_id)}${
                              b.is_bundle
                                ? `?bundle=${encodeURIComponent(b.bundle_id)}`
                                : ''
                            }`,
                          )
                        }
                        style={{
                          ...feedGridCardBoxFlat,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={feedGridImageBoxRegion}>
                          {cover ? (
                            <img
                              src={cover}
                              alt={b.place_name || headerTitle}
                              loading="eager"
                              decoding="async"
                              fetchPriority={
                                idx < SCREEN_IMAGE_HIGH_PRIORITY_COUNT
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
                          {count > 1 && (
                            <span
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                zIndex: 3,
                                background: 'rgba(0,0,0,0.62)',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 6,
                                padding: '2px 6px',
                              }}
                            >
                              {count}
                            </span>
                          )}
                        </div>

                        <div className="min-h-0 flex flex-col gap-0.5 overflow-hidden px-0.5 pb-0.5 pt-0">
                          <div className="text-[13px] font-bold text-gray-900 dark:text-gray-100 truncate shrink-0">
                            {b.place_name || '위치 정보 없음'}
                          </div>
                          {b.body && (
                            <div className="text-xs text-gray-600 dark:text-gray-300 leading-snug max-h-[2.7em] overflow-hidden line-clamp-2">
                              {b.body}
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-0.5 shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                            <span>{timeAgo(b.primary_taken_at)}</span>
                            {cat && (
                              <span className="inline-flex items-center gap-1 shrink-0">
                                {CatIcon && (
                                  <CatIcon
                                    size={12}
                                    stroke={2}
                                    color="currentColor"
                                  />
                                )}
                                {cat.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MapPinListScreen;
