import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconArrowLeft,
  IconSearch,
  IconCurrentLocation,
  IconShieldCheck,
  IconHeart,
  IconMessageCircle,
  IconBookmark,
  IconArrowRight,
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';
import { supabase } from '../utils/supabaseClient';
import { getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

// ────────────────────────────────────────────────
// 디자인 토큰 (스펙 §3)
// ────────────────────────────────────────────────
const KEY = '#4DB8E8';
const KEY_LIGHT = '#E8F4FB';
const KEY_DARK = '#1A6EA8';
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울 시청 (GPS 폴백)

// 카테고리 (스펙 §8-2)
const CATEGORIES = [
  { id: 'all', label: '전체', Icon: null },
  { id: 'nature', label: '개화·자연', Icon: IconFlower },
  { id: 'weather', label: '날씨·체감', Icon: IconCloud },
  { id: 'event', label: '이벤트·축제', Icon: IconCalendarEvent },
  { id: 'crowd', label: '혼잡도·대기', Icon: IconUsers },
  { id: 'sunset', label: '노을·야경', Icon: IconMoon },
  { id: 'business', label: '영업·운영', Icon: IconBuildingStore },
];

const CATEGORY_META = {
  nature: { Icon: IconFlower, label: '개화·자연' },
  weather: { Icon: IconCloud, label: '날씨·체감' },
  event: { Icon: IconCalendarEvent, label: '이벤트·축제' },
  crowd: { Icon: IconUsers, label: '혼잡도·대기' },
  sunset: { Icon: IconMoon, label: '노을·야경' },
  business: { Icon: IconBuildingStore, label: '영업·운영' },
};

// ────────────────────────────────────────────────
// 유틸 (스펙 §12)
// ────────────────────────────────────────────────
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

function formatHoursLeft(iso) {
  if (!iso) return '';
  const expires = new Date(iso).getTime() + 48 * 60 * 60 * 1000;
  const ms = expires - Date.now();
  if (ms <= 0) return '만료됨';
  const hour = Math.floor(ms / 3600000);
  if (hour < 1) return `${Math.max(1, Math.floor(ms / 60000))}분 남음`;
  return `${hour}시간 남음`;
}

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// ────────────────────────────────────────────────
// Kakao SDK 로더 (clusterer + services 포함)
// ────────────────────────────────────────────────
const getKakaoAppKey = () =>
  String(import.meta.env.VITE_KAKAO_MAP_API_KEY || '').trim();

const loadKakaoSdkOnce = (appKey) =>
  new Promise((resolve, reject) => {
    const key = String(appKey || '').trim();
    if (!key) {
      reject(new Error('VITE_KAKAO_MAP_API_KEY가 비어있습니다.'));
      return;
    }
    if (window.kakao?.maps) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-kakao-maps-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Kakao SDK 로드 실패')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.kakaoMapsSdk = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      key,
    )}&autoload=false&libraries=services,clusterer`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kakao SDK 로드 실패'));
    document.head.appendChild(script);
  });

const ensureKakaoMapsReady = async () => {
  await loadKakaoSdkOnce(getKakaoAppKey());
  await new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.load) {
      reject(new Error('Kakao SDK 초기화 실패'));
      return;
    }
    window.kakao.maps.load(() => resolve());
  });
};

// ────────────────────────────────────────────────
// 핀 HTML 빌더 (CustomOverlay content)
// ────────────────────────────────────────────────
function buildPinHTML(bundle, { isSelected, isOtherSelected }) {
  const thumb = esc(getDisplayImageUrl(bundle.primary_thumbnail || ''));
  const size = isSelected ? 56 : isOtherSelected ? 32 : 38;
  const borderW = isSelected ? 3.5 : 2.5;
  const radius = isSelected ? 12 : 9;
  const opacity = isOtherSelected && !isSelected ? 0.5 : 1;
  const outline = isSelected
    ? `outline:2.5px solid ${KEY};outline-offset:0;`
    : '';
  const shadow = isSelected
    ? '0 6px 20px rgba(77,184,232,0.4)'
    : '0 3px 9px rgba(0,0,0,0.18)';
  const arrowColor = isSelected ? KEY : '#ffffff';
  const arrowW = isSelected ? 8 : 6;
  const arrowH = isSelected ? 11 : 7;
  const arrowBottom = isSelected ? -10 : -6;

  const bundleBadge = bundle.is_bundle
    ? `<div style="position:absolute;top:${isSelected ? -7 : -5}px;right:${
        isSelected ? -7 : -5
      }px;background:rgba(0,0,0,${
        isSelected ? 0.7 : 0.65
      });padding:${
        isSelected ? '2px 6px' : '1px 4px'
      };border-radius:${isSelected ? 6 : 3}px;display:flex;align-items:center;gap:${
        isSelected ? 4 : 2
      }px;border:${isSelected ? 2 : 1.5}px solid white;pointer-events:none;">
        <svg width="${isSelected ? 9 : 7}" height="${
        isSelected ? 9 : 7
      }" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><rect width="14" height="14" x="9" y="3" rx="2"/></svg>
        <span style="font-size:${
          isSelected ? 9 : 7
        }px;color:white;font-weight:700;line-height:1;">${
        bundle.bundle_count
      }</span>
      </div>`
    : '';

  const imgFallbackBg = thumb
    ? ''
    : 'background-image:linear-gradient(135deg,#e0f7fa,#b2ebf2);';

  return `<div style="position:relative;opacity:${opacity};transition:all 0.15s ease;cursor:pointer;">
    <div style="width:${size}px;height:${size}px;background-image:url('${thumb}');${imgFallbackBg}background-size:cover;background-position:center;border:${borderW}px solid white;border-radius:${radius}px;box-shadow:${shadow};${outline}background-color:#f3f4f6;"></div>
    <div style="position:absolute;bottom:${arrowBottom}px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:${arrowW}px solid transparent;border-right:${arrowW}px solid transparent;border-top:${arrowH}px solid ${arrowColor};filter:drop-shadow(0 2px 2px rgba(0,0,0,0.12));pointer-events:none;"></div>
    ${bundleBadge}
  </div>`;
}

function buildMyLocationHTML() {
  return `<div style="width:16px;height:16px;background:${KEY};border-radius:50%;border:3px solid white;box-shadow:0 0 0 6px rgba(77,184,232,0.2), 0 0 0 12px rgba(77,184,232,0.1);"></div>`;
}

// ────────────────────────────────────────────────
// 하위 컴포넌트들 (스펙 §8)
// ────────────────────────────────────────────────

// 8-1. MapHeader
function MapHeader() {
  const navigate = useNavigate();
  return (
    <div className="absolute top-3.5 left-3.5 right-3.5 z-10 flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="bg-white w-[42px] h-[42px] rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
        aria-label="뒤로가기"
      >
        <IconArrowLeft size={20} color="#1F1F1F" />
      </button>
      <button
        type="button"
        onClick={() => navigate('/search?context=map')}
        className="flex-1 bg-white h-[42px] rounded-xl flex items-center px-3.5 gap-2.5"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
      >
        <IconSearch size={18} color="#6B6B6B" />
        <span className="text-[13px] text-[#B8B8B8] flex-1 text-left">
          장소 또는 지역 검색
        </span>
      </button>
    </div>
  );
}

// 8-2. MapCategoryFilter (마우스 드래그 + 터치 스와이프 가로 스크롤)
function MapCategoryFilter({ selected, onChange }) {
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();

  // 드래그 직후 칩이 잘못 발화되지 않게 가드
  const guardedClick = (handler) => (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler();
  };

  return (
    <div className="absolute top-[68px] left-3.5 right-3.5 z-10">
      <div
        onMouseDown={handleDragStart}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selected === cat.id;
          const Icon = cat.Icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={guardedClick(() => onChange(cat.id))}
              className={`text-[11px] px-3.5 py-1.5 rounded-2xl whitespace-nowrap flex items-center gap-1 flex-shrink-0 select-none ${
                isActive ? 'text-white font-semibold' : 'text-[#1F1F1F]'
              }`}
              style={{
                background: isActive ? KEY : '#ffffff',
                boxShadow: isActive
                  ? '0 2px 6px rgba(77, 184, 232, 0.3)'
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              {Icon && (
                <Icon
                  size={11}
                  stroke={1.8}
                  color={isActive ? '#ffffff' : '#1F1F1F'}
                />
              )}
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 8-3. MyLocationButton (하단 우측, 단순한 흰 원형 + 키컬러 아이콘)
function MyLocationButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="내 위치"
      className="absolute right-[18px] bottom-[24px] z-10 bg-white w-[44px] h-[44px] rounded-full flex items-center justify-center"
      style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}
    >
      <IconCurrentLocation size={20} color={KEY} strokeWidth={2} />
    </button>
  );
}

function AuthorAvatar({ name, color, onClick }) {
  const ch = String(name || '?').trim().charAt(0).toUpperCase() || '·';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
      style={{ background: color || KEY }}
    >
      {ch}
    </button>
  );
}

function CardArrowTail() {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 rotate-45 bg-white"
      style={{
        top: -7,
        width: 14,
        height: 14,
        boxShadow: '-3px -3px 5px rgba(0,0,0,0.04)',
      }}
      aria-hidden
    />
  );
}

// 8-8. PostPinPreview
function PostPinPreview({
  bundle,
  onViewDetail,
  onAuthorClick,
  onLocationClick,
}) {
  const cat = CATEGORY_META[bundle.category];
  const CatIcon = cat?.Icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-[120px] left-3.5 right-3.5 z-20"
    >
      <div className="relative max-w-[414px] mx-auto">
        <CardArrowTail />
        <div
          className="bg-white overflow-hidden"
          style={{
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          {/* 사진 */}
          <div className="relative h-[200px] bg-[#F5F7FA]">
            {bundle.primary_thumbnail && (
              <img
                src={getDisplayImageUrl(bundle.primary_thumbnail)}
                alt=""
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            )}
            <div className="absolute top-2.5 left-2.5 bg-black/70 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <IconShieldCheck size={11} color={KEY} />
              <span className="text-[11px] text-white font-semibold">
                {timeAgo(bundle.primary_taken_at)}
              </span>
            </div>
            {cat && (
              <div className="absolute top-2.5 right-2.5 bg-white px-2.5 py-1 rounded-md flex items-center gap-1">
                {CatIcon && (
                  <CatIcon size={10} stroke={1.8} color="#1F1F1F" />
                )}
                <span className="text-[10px] font-semibold">{cat.label}</span>
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="p-3 px-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <AuthorAvatar
                name={bundle.author_name}
                color={bundle.author_avatar_color}
                onClick={onAuthorClick}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onAuthorClick}
                    className="text-[13px] font-semibold text-[#1F1F1F]"
                  >
                    {bundle.author_name}
                  </button>
                  {bundle.is_author_on_site && (
                    <div
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                      style={{ background: KEY_LIGHT }}
                    >
                      <div
                        className="w-1 h-1 rounded-full"
                        style={{ background: KEY }}
                      />
                      <span
                        className="text-[9px] font-semibold"
                        style={{ color: KEY_DARK }}
                      >
                        지금 현장
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onLocationClick}
                  className="text-[10px] text-[#6B6B6B] mt-0.5 m-0 block text-left truncate w-full"
                >
                  {bundle.place_name || '위치 없음'} ·{' '}
                  {formatHoursLeft(bundle.primary_taken_at)}
                </button>
              </div>
            </div>

            {bundle.body ? (
              <p className="text-[12px] line-clamp-2 mb-3 leading-relaxed text-[#1F1F1F]">
                {bundle.body}
              </p>
            ) : null}

            <div className="flex gap-4 pt-2.5 border-t border-[#F5F7FA] text-[11px] text-[#6B6B6B]">
              <span className="flex items-center gap-1">
                <IconHeart size={13} /> {bundle.likes_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <IconMessageCircle size={13} /> {bundle.comments_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <IconBookmark size={13} /> {bundle.saves_count || 0}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewDetail}
            className="w-full text-white py-2.5 text-[13px] font-semibold flex items-center justify-center gap-1.5"
            style={{ background: KEY }}
          >
            게시물 상세 보기
            <IconArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// 8-9. BundlePinPreview
function BundlePinPreview({ bundle, photos, onViewDetail, onAuthorClick }) {
  const total = bundle.bundle_count;
  const isPair = total === 2;
  const visible = isPair ? photos.slice(0, 2) : photos.slice(0, 3);
  const extra = total > 3 ? total - 3 : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-[120px] left-3.5 right-3.5 z-20"
    >
      <div className="relative max-w-[414px] mx-auto">
        <CardArrowTail />
        <div
          className="bg-white overflow-hidden"
          style={{
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div className="p-3 px-3.5 pb-0">
            {/* 작성자 */}
            <div className="flex items-center gap-2 mb-3">
              <AuthorAvatar
                name={bundle.author_name}
                color={bundle.author_avatar_color}
                onClick={onAuthorClick}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onAuthorClick}
                    className="text-[13px] font-semibold text-[#1F1F1F]"
                  >
                    {bundle.author_name}
                  </button>
                  {bundle.is_author_on_site && (
                    <div
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                      style={{ background: KEY_LIGHT }}
                    >
                      <div
                        className="w-1 h-1 rounded-full"
                        style={{ background: KEY }}
                      />
                      <span
                        className="text-[9px] font-semibold"
                        style={{ color: KEY_DARK }}
                      >
                        지금 현장
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[#6B6B6B] mt-0.5 m-0 truncate">
                  {bundle.place_name || '위치 없음'} · 1시간 동안 {total}장
                </p>
              </div>
            </div>

            {/* 사진 그리드 */}
            <div className="flex gap-1.5 mb-3">
              {visible.map((p, idx) => {
                const isLast = idx === visible.length - 1;
                const showOverlay = !isPair && isLast && extra > 0;
                return (
                  <div
                    key={p.post_id}
                    className="flex-1 rounded-lg relative overflow-hidden bg-[#F5F7FA]"
                    style={{ aspectRatio: isPair ? '16 / 10' : '1 / 1' }}
                  >
                    {p.thumbnail_url && (
                      <img
                        src={getDisplayImageUrl(p.thumbnail_url)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <IconShieldCheck size={9} color={KEY} />
                      <span className="text-[9px] text-white font-semibold">
                        {timeAgo(p.exif_taken_at)}
                      </span>
                    </div>
                    {showOverlay && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-base font-bold">
                          +{extra}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {bundle.body ? (
              <p className="text-[12px] line-clamp-1 mb-3 leading-relaxed text-[#1F1F1F]">
                {bundle.body}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onViewDetail}
            className="w-full text-white py-2.5 text-[13px] font-semibold flex items-center justify-center gap-1.5"
            style={{ background: KEY }}
          >
            {total}장 모두 보기
            <IconArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────
// 훅 (스펙 §9)
// ────────────────────────────────────────────────

function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle');

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      setCoords(DEFAULT_CENTER);
      return;
    }
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setStatus('granted');
      },
      () => {
        setStatus('denied');
        setCoords(DEFAULT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { coords, status, requestLocation };
}

function useMapBundles(bounds, category) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(0);

  useEffect(() => {
    if (!bounds) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_map_bundles', {
          p_sw_lat: bounds.sw.lat,
          p_sw_lng: bounds.sw.lng,
          p_ne_lat: bounds.ne.lat,
          p_ne_lng: bounds.ne.lng,
          p_category: category === 'all' ? null : category,
        });
        if (error) {
          logger.warn('get_map_bundles 실패', error?.message || error);
          setBundles([]);
        } else {
          setBundles(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        logger.warn('get_map_bundles 예외', e?.message || e);
        setBundles([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bounds, category]);

  return { bundles, loading };
}

function useBundleDetail(bundleId) {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    if (!bundleId) {
      setPhotos([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_bundle_detail', {
        p_bundle_id: bundleId,
      });
      if (cancelled) return;
      if (error) {
        logger.warn('get_bundle_detail 실패', error?.message || error);
        setPhotos([]);
      } else if (Array.isArray(data)) {
        setPhotos(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundleId]);
  return { photos };
}

// ────────────────────────────────────────────────
// MapScreen (스펙 §11)
// ────────────────────────────────────────────────
const MapScreen = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const overlayMapRef = useRef(new Map()); // bundle_id -> { overlay, wrap }
  const myLocationOverlayRef = useRef(null);
  const clustererRef = useRef(null);
  const idleListenerRef = useRef(null);
  const clickListenerRef = useRef(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const [bounds, setBounds] = useState(null);
  const [mapLevel, setMapLevel] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBundleId, setSelectedBundleId] = useState(null);

  const { coords: myLocation, requestLocation } = useGeolocation();
  const { bundles } = useMapBundles(bounds, selectedCategory);

  const selectedBundle = useMemo(
    () => bundles.find((b) => b.bundle_id === selectedBundleId) || null,
    [bundles, selectedBundleId],
  );
  const { photos: bundlePhotos } = useBundleDetail(
    selectedBundle?.is_bundle ? selectedBundleId : null,
  );

  // 1) Kakao SDK 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureKakaoMapsReady();
        if (!cancelled) setSdkReady(true);
      } catch (e) {
        if (!cancelled) setSdkError(e?.message || '카카오 SDK 로드 실패');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) 지도 인스턴스 생성 + idle/click 리스너
  useEffect(() => {
    if (!sdkReady) return undefined;
    const el = mapRef.current;
    if (!el) return undefined;

    const kakao = window.kakao;
    const center = new kakao.maps.LatLng(
      DEFAULT_CENTER.lat,
      DEFAULT_CENTER.lng,
    );
    const map = new kakao.maps.Map(el, { center, level: 5 });
    kakaoMapRef.current = map;
    setMapLevel(map.getLevel());

    const onIdle = () => {
      const b = map.getBounds();
      setBounds({
        sw: {
          lat: b.getSouthWest().getLat(),
          lng: b.getSouthWest().getLng(),
        },
        ne: {
          lat: b.getNorthEast().getLat(),
          lng: b.getNorthEast().getLng(),
        },
      });
      setMapLevel(map.getLevel());
    };
    kakao.maps.event.addListener(map, 'idle', onIdle);
    idleListenerRef.current = { map, onIdle };
    onIdle();

    const onClick = () => setSelectedBundleId(null);
    kakao.maps.event.addListener(map, 'click', onClick);
    clickListenerRef.current = { map, onClick };

    return () => {
      const il = idleListenerRef.current;
      if (il?.map && window.kakao?.maps?.event) {
        try {
          window.kakao.maps.event.removeListener(il.map, 'idle', il.onIdle);
        } catch {
          /* ignore */
        }
      }
      const cl = clickListenerRef.current;
      if (cl?.map && window.kakao?.maps?.event) {
        try {
          window.kakao.maps.event.removeListener(
            cl.map,
            'click',
            cl.onClick,
          );
        } catch {
          /* ignore */
        }
      }
      idleListenerRef.current = null;
      clickListenerRef.current = null;
      kakaoMapRef.current = null;

      for (const item of overlayMapRef.current.values()) {
        try {
          item.overlay.setMap(null);
        } catch {
          /* ignore */
        }
      }
      overlayMapRef.current.clear();
      try {
        clustererRef.current?.clear();
      } catch {
        /* ignore */
      }
      clustererRef.current = null;
      try {
        myLocationOverlayRef.current?.setMap(null);
      } catch {
        /* ignore */
      }
      myLocationOverlayRef.current = null;
    };
  }, [sdkReady]);

  // 3) 핀 오버레이 갱신
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return;
    const kakao = window.kakao;

    const useClustering = mapLevel >= 6;
    const nextIds = new Set(bundles.map((b) => b.bundle_id));

    // viewport 밖 오버레이 제거
    for (const [bid, item] of overlayMapRef.current.entries()) {
      if (!nextIds.has(bid)) {
        try {
          item.overlay.setMap(null);
        } catch {
          /* ignore */
        }
        overlayMapRef.current.delete(bid);
      }
    }

    // 추가/업데이트
    bundles.forEach((bundle) => {
      const id = bundle.bundle_id;
      const isSelected = id === selectedBundleId;
      const isOtherSelected = !!selectedBundleId && !isSelected;
      const innerHtml = buildPinHTML(bundle, { isSelected, isOtherSelected });
      const display = useClustering ? 'none' : '';

      const existing = overlayMapRef.current.get(id);
      if (existing) {
        existing.wrap.innerHTML = innerHtml;
        existing.wrap.style.display = display;
        try {
          existing.overlay.setPosition(
            new kakao.maps.LatLng(bundle.primary_lat, bundle.primary_lng),
          );
        } catch {
          /* ignore */
        }
        return;
      }

      const wrap = document.createElement('div');
      wrap.style.display = display;
      wrap.innerHTML = innerHtml;
      wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedBundleId(id);
        try {
          map.panTo(
            new kakao.maps.LatLng(bundle.primary_lat, bundle.primary_lng),
          );
        } catch {
          /* ignore */
        }
      });

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(
          bundle.primary_lat,
          bundle.primary_lng,
        ),
        content: wrap,
        yAnchor: 1,
        xAnchor: 0.5,
        zIndex: isSelected ? 5 : 3,
        clickable: true,
      });
      overlay.setMap(map);
      overlayMapRef.current.set(id, { overlay, wrap });
    });

    // 클러스터러 (level >= 6)
    try {
      const Clusterer = window.kakao?.maps?.MarkerClusterer;
      if (Clusterer) {
        if (!clustererRef.current) {
          clustererRef.current = new Clusterer({
            map,
            averageCenter: true,
            minLevel: 6,
            gridSize: 60,
            disableClickZoom: false,
            styles: [
              {
                width: '40px',
                height: '40px',
                background: '#ffffff',
                border: `2px solid ${KEY}`,
                borderRadius: '20px',
                color: '#1F1F1F',
                textAlign: 'center',
                fontWeight: '700',
                fontSize: '12px',
                lineHeight: '36px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.13)',
              },
              {
                width: '48px',
                height: '48px',
                background: '#ffffff',
                border: `2px solid ${KEY}`,
                borderRadius: '24px',
                color: '#1F1F1F',
                textAlign: 'center',
                fontWeight: '700',
                fontSize: '13px',
                lineHeight: '44px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
              },
              {
                width: '56px',
                height: '56px',
                background: KEY,
                border: '2px solid #ffffff',
                borderRadius: '28px',
                color: '#ffffff',
                textAlign: 'center',
                fontWeight: '700',
                fontSize: '14px',
                lineHeight: '52px',
                boxShadow: '0 4px 14px rgba(77,184,232,0.45)',
              },
            ],
            calculator: [10, 50],
          });
        }
        clustererRef.current.clear();
        if (useClustering) {
          const markers = bundles
            .map(
              (b) =>
                new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(
                    b.primary_lat,
                    b.primary_lng,
                  ),
                }),
            )
            .filter(Boolean);
          clustererRef.current.addMarkers(markers);
        }
      }
    } catch {
      /* ignore */
    }
  }, [bundles, selectedBundleId, mapLevel]);

  // 4) 내 위치 마커
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps || !myLocation) return undefined;
    const kakao = window.kakao;
    if (myLocationOverlayRef.current) {
      try {
        myLocationOverlayRef.current.setMap(null);
      } catch {
        /* ignore */
      }
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = buildMyLocationHTML();
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(myLocation.lat, myLocation.lng),
      content: wrap,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 4,
    });
    overlay.setMap(map);
    myLocationOverlayRef.current = overlay;
    return () => {
      try {
        overlay.setMap(null);
      } catch {
        /* ignore */
      }
    };
  }, [myLocation]);

  // 내 위치 버튼
  const handleMyLocation = useCallback(() => {
    requestLocation();
    if (myLocation && kakaoMapRef.current && window.kakao?.maps) {
      try {
        kakaoMapRef.current.panTo(
          new window.kakao.maps.LatLng(myLocation.lat, myLocation.lng),
        );
      } catch {
        /* ignore */
      }
    }
  }, [requestLocation, myLocation]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden font-sans bg-[#EDF3F7]">
      <PageSeo {...PAGE_SEO.map} />
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* SDK 에러 안내 */}
      {!!sdkError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/70 px-6 text-center">
          <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
            <p className="text-sm font-bold text-gray-900">
              지도를 불러오지 못했어요
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-600">
              {sdkError}
            </p>
          </div>
        </div>
      )}

      <MapHeader />
      <MapCategoryFilter
        selected={selectedCategory}
        onChange={setSelectedCategory}
      />
      <MyLocationButton onClick={handleMyLocation} />

      <AnimatePresence>
        {selectedBundle && !selectedBundle.is_bundle && (
          <PostPinPreview
            key={`single-${selectedBundleId}`}
            bundle={selectedBundle}
            onViewDetail={() =>
              navigate(
                `/post/${encodeURIComponent(selectedBundle.primary_post_id)}`,
              )
            }
            onAuthorClick={() =>
              navigate(`/user/${encodeURIComponent(selectedBundle.author_id)}`)
            }
            onLocationClick={() => {
              if (selectedBundle.place_name) {
                navigate(
                  `/region/${encodeURIComponent(selectedBundle.place_name)}`,
                );
              }
            }}
          />
        )}
        {selectedBundle && selectedBundle.is_bundle && (
          <BundlePinPreview
            key={`bundle-${selectedBundleId}`}
            bundle={selectedBundle}
            photos={bundlePhotos}
            onViewDetail={() =>
              navigate(
                `/post/${encodeURIComponent(
                  selectedBundle.primary_post_id,
                )}?bundle=${encodeURIComponent(selectedBundle.bundle_id)}`,
              )
            }
            onAuthorClick={() =>
              navigate(`/user/${encodeURIComponent(selectedBundle.author_id)}`)
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapScreen;
