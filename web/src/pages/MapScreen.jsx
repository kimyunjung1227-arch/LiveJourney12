import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconArrowLeft,
  IconSearch,
  IconCurrentLocation,
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
  IconMapPin,
  IconX,
  IconMap,
  IconRefresh,
} from '@tabler/icons-react';
import { supabase } from '../utils/supabaseClient';
import { getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import { searchPlaceWithKakaoFirst } from '../utils/kakaoPlacesGeocode';
import { useKakaoPlaceSearch } from '../hooks/useKakaoPlaceSearch';
import { searchRegions, loadRegionRings } from '../utils/regionBoundary';
import { fetchProfileByIdSupabase, fetchProfilesByIdsSupabase } from '../api/profilesSupabase';
import ExifFreshIcon from '../components/lj/ExifFreshIcon';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

// 작성자명이 "표시용 닉네임"이 아니라 시스템 식별자/임시값으로 보이면 true
const isAnonymousName = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return true;
  if (s === '익명' || s === '익명사용자') return true;
  if (/^익명[\s_-]?\d*$/i.test(s)) return true;
  if (/^anonymous$/i.test(s)) return true;
  // 이메일 형태(user@host) — 닉네임이 아님
  if (/@/.test(s)) return true;
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  // user_xxx / user-xxx / User123
  if (/^user[-_]?\w*$/i.test(s)) return true;
  // 라이브저니 자동 부여 패턴 (예: "사용자123", "유저123")
  if (/^(사용자|유저)\s*\d+$/.test(s)) return true;
  return false;
};

// 지오코드 결과 캐시 (place_name → {lat, lng} | null). 페이지 수명 동안 유지.
const GEO_CACHE_KEY = '__lj_map_geo_cache_v4';
function getGeoCache() {
  const g = globalThis;
  if (!g[GEO_CACHE_KEY] || typeof g[GEO_CACHE_KEY] !== 'object') {
    g[GEO_CACHE_KEY] = new Map();
  }
  return g[GEO_CACHE_KEY];
}

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

// 두 좌표 사이 거리 (m) — 검색 장소 주변 라이브 집계용
function distMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
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
    // 12초 타임아웃 (도메인 화이트리스트 누락 등으로 load 콜백이 끝까지 안 올 때 대비)
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Kakao 지도 로드가 너무 오래 걸려요. 새로고침해 주세요.'));
    }, 12000);
    window.kakao.maps.load(() => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve();
    });
  });
};

// ────────────────────────────────────────────────
// 핀 HTML 빌더 (CustomOverlay content)
// ────────────────────────────────────────────────
function buildPinHTML(bundle, { isSelected, isOtherSelected }) {
  const thumb = esc(getDisplayImageUrl(bundle.primary_thumbnail || ''));
  const size = isSelected ? 76 : isOtherSelected ? 44 : 54;
  const borderW = isSelected ? 4 : 3;
  const radius = isSelected ? 16 : 12;
  const opacity = isOtherSelected && !isSelected ? 0.5 : 1;
  const outline = isSelected
    ? `outline:3px solid ${KEY};outline-offset:0;`
    : '';
  const shadow = isSelected
    ? '0 8px 24px rgba(77,184,232,0.45)'
    : '0 4px 12px rgba(0,0,0,0.22)';
  const arrowColor = isSelected ? KEY : '#ffffff';
  const arrowW = isSelected ? 10 : 8;
  const arrowH = isSelected ? 14 : 10;
  const arrowBottom = isSelected ? -13 : -9;

  const bundleBadge = bundle.is_bundle
    ? `<div style="position:absolute;top:${isSelected ? -9 : -7}px;right:${
        isSelected ? -9 : -7
      }px;background:rgba(0,0,0,${
        isSelected ? 0.78 : 0.7
      });padding:${
        isSelected ? '3px 9px' : '2px 6px'
      };border-radius:${isSelected ? 9 : 6}px;display:flex;align-items:center;gap:${
        isSelected ? 5 : 3
      }px;border:${isSelected ? 2.5 : 2}px solid white;pointer-events:none;">
        <svg width="${isSelected ? 12 : 9}" height="${
        isSelected ? 12 : 9
      }" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><rect width="14" height="14" x="9" y="3" rx="2"/></svg>
        <span style="font-size:${
          isSelected ? 12 : 10
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

// 검색한 장소 핀 (키컬러 티어드롭, 플랫)
function buildSearchPinHTML() {
  return `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
    <div style="width:36px;height:36px;background:${KEY};border:3px solid white;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);box-shadow:0 6px 18px rgba(77,184,232,0.5);display:flex;align-items:center;justify-content:center;">
      <div style="width:11px;height:11px;background:white;border-radius:50%;transform:rotate(45deg);"></div>
    </div>
  </div>`;
}

// ────────────────────────────────────────────────
// 하위 컴포넌트들 (스펙 §8)
// ────────────────────────────────────────────────

// 8-1. MapSearchHeader — 지도 화면 내 장소 검색 (화면 이동 없이 바로 결과 표시)
function MapSearchHeader({
  query,
  onQueryChange,
  results,
  regions,
  loading,
  showResults,
  onFocus,
  onSelect,
  onSelectRegion,
  onClear,
  onRefresh,
  refreshing = false,
}) {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // 지역 매치가 있으면 지역 우선 (날씨 등 지역 단위 검색이 흔한 패턴)
      if (regions.length > 0) {
        e.preventDefault();
        onSelectRegion(regions[0]);
        inputRef.current?.blur();
      } else if (results.length > 0) {
        e.preventDefault();
        onSelect(results[0]);
        inputRef.current?.blur();
      }
    }
    if (e.key === 'Escape') {
      onClear();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="absolute top-3.5 left-3.5 right-3.5 z-30">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="bg-white w-[42px] h-[42px] rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
          aria-label="뒤로가기"
        >
          <IconArrowLeft size={20} color="#1F1F1F" />
        </button>
        <div
          className="flex-1 bg-white h-[42px] rounded-xl flex items-center px-3.5 gap-2.5"
          style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
        >
          <IconSearch size={18} color="#6B6B6B" className="flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            placeholder="장소 또는 지역 검색"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[#1F1F1F] placeholder-[#B8B8B8]"
            style={{ border: 'none', outline: 'none', padding: 0 }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
              aria-label="검색어 지우기"
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: 20,
                height: 20,
                minWidth: 20,
                minHeight: 20,
                borderRadius: '50%',
                background: '#E8E8E8',
                border: 'none',
                padding: 0,
              }}
            >
              <IconX size={11} color="#6B6B6B" stroke={2.5} />
            </button>
          )}
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="bg-white w-[42px] h-[42px] rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)', border: 'none', cursor: refreshing ? 'wait' : 'pointer' }}
            aria-label="새로고침"
          >
            <IconRefresh
              size={19}
              color={KEY}
              stroke={2.2}
              style={{
                animation: refreshing ? 'lj-map-spin 0.8s linear infinite' : 'none',
              }}
            />
          </button>
        )}
      </div>
      <style>{`@keyframes lj-map-spin { to { transform: rotate(360deg); } }`}</style>

      {/* 검색 결과 드롭다운 (지도 위 오버레이) */}
      {showResults && (
        <div
          className="mt-2 ml-[52px] bg-white overflow-hidden"
          style={{
            borderRadius: 8,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {/* 지역(행정구역) 결과 — 선택 시 지역 전체가 테두리로 표시됨 */}
          {regions.map((region) => (
            <button
              key={`region-${region.code}`}
              type="button"
              onClick={() => onSelectRegion(region)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left border-b border-[#F5F7FA] active:bg-[#F5F7FA]"
              style={{ background: 'none' }}
            >
              <div
                className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{ background: KEY }}
              >
                <IconMap size={15} color="#ffffff" stroke={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1F1F1F] truncate m-0">
                  {region.displayName || region.name}
                </p>
                <p className="text-[11px] text-[#6B6B6B] truncate m-0">
                  {region.province
                    ? `${region.province} · 지역 전체 보기`
                    : '지역 전체 보기'}
                </p>
              </div>
              <span
                className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: KEY_LIGHT, color: KEY_DARK }}
              >
                지역
              </span>
            </button>
          ))}
          {loading && (
            <div className="px-4 py-3 text-[12px] text-[#6B6B6B]">검색 중…</div>
          )}
          {!loading && results.length === 0 && regions.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-[#6B6B6B]">
              검색 결과가 없어요
            </div>
          )}
          {!loading &&
            results.slice(0, 8).map((place) => (
              <button
                key={place.kakao_id}
                type="button"
                onClick={() => onSelect(place)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left border-b border-[#F5F7FA] last:border-b-0 active:bg-[#F5F7FA]"
                style={{ background: 'none' }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: KEY_LIGHT }}
                >
                  <IconMapPin size={15} color={KEY_DARK} stroke={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1F1F1F] truncate m-0">
                    {place.name}
                  </p>
                  <p className="text-[11px] text-[#6B6B6B] truncate m-0">
                    {place.address}
                  </p>
                </div>
                {place.category && (
                  <span className="flex-shrink-0 text-[10px] text-[#B8B8B8]">
                    {place.category}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// 8-2. MapCategoryFilter — 홈 화면(CategoryFilter)과 동일한 칩 스타일 + 흰 배경 띠
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
    <div
      className="absolute left-0 right-0 z-10"
      style={{ top: 64 }}
    >
      <div
        onMouseDown={handleDragStart}
        className="lj-no-scrollbar flex overflow-x-auto cursor-grab active:cursor-grabbing"
        style={{
          gap: 8,
          padding: '12px 18px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selected === cat.id;
          const Icon = cat.Icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={guardedClick(() => onChange(cat.id))}
              className="flex-shrink-0 inline-flex items-center whitespace-nowrap select-none"
              style={{
                gap: 4,
                padding: '7px 12px',
                borderRadius: 999,
                border: isActive ? 'none' : '1px solid #E8E8E8',
                background: isActive ? KEY : '#ffffff',
                color: isActive ? '#ffffff' : '#1F1F1F',
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                lineHeight: 1.4,
                cursor: 'pointer',
              }}
            >
              {Icon && (
                <Icon
                  size={14}
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
//   - raised: 하단에 검색 장소 카드가 떠 있을 때 카드 위로 올라감
function MyLocationButton({ onClick, raised }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="내 위치"
      className="absolute right-[18px] z-10 bg-white w-[44px] h-[44px] rounded-full flex items-center justify-center"
      style={{
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        bottom: raised ? 196 : 24,
        transition: 'bottom 0.2s ease',
      }}
    >
      <IconCurrentLocation size={20} color={KEY} strokeWidth={2} />
    </button>
  );
}

function AuthorAvatar({ name, color, avatarUrl, onClick }) {
  const ch = String(name || '?').trim().charAt(0).toUpperCase() || '·';
  const src = avatarUrl ? getDisplayImageUrl(avatarUrl) : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden"
      style={{
        width: 30,
        minWidth: 30,
        maxWidth: 30,
        height: 30,
        minHeight: 30,
        maxHeight: 30,
        borderRadius: '50%',
        background: color || KEY,
        fontSize: 13,
        border: 'none',
        padding: 0,
        boxSizing: 'border-box',
        appearance: 'none',
        WebkitAppearance: 'none',
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.parentElement) {
              e.currentTarget.parentElement.textContent = ch;
            }
          }}
        />
      ) : (
        ch
      )}
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
      className="absolute top-[150px] left-3.5 right-3.5 z-20"
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
              <ExifFreshIcon iso={bundle.primary_taken_at} size={11} />
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
            {/* 프로필 섹션 */}
            <div className="flex items-center gap-2.5 mb-3">
              <AuthorAvatar
                name={bundle.author_name}
                color={bundle.author_avatar_color}
                avatarUrl={bundle.author_avatar_url}
                onClick={onAuthorClick}
              />
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap" style={{ lineHeight: 1.2 }}>
                <button
                  type="button"
                  onClick={onAuthorClick}
                  className="text-[14px] font-bold text-[#1F1F1F]"
                  style={{ padding: 0, lineHeight: 1.2, background: 'none', border: 'none' }}
                >
                  {bundle.author_name || '이름 없음'}
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
            </div>

            {/* 장소 섹션 — 프로필과 분리, 남은시간은 우측 정렬 */}
            <div className="flex items-center gap-2 mb-3">
              <IconMapPin size={14} color={KEY} stroke={2} className="flex-shrink-0" />
              <button
                type="button"
                onClick={onLocationClick}
                className="flex-1 min-w-0 text-left text-[13px] font-semibold text-[#1F1F1F]"
                style={{
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  lineHeight: 1.3,
                  wordBreak: 'keep-all',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {bundle.place_name || '위치 정보 없음'}
              </button>
              <span
                className="flex-shrink-0 text-[11px] font-semibold"
                style={{ color: KEY_DARK, whiteSpace: 'nowrap' }}
              >
                {formatHoursLeft(bundle.primary_taken_at)}
              </span>
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
      className="absolute top-[150px] left-3.5 right-3.5 z-20"
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
            {/* 프로필 섹션 */}
            <div className="flex items-center gap-2.5 mb-3">
              <AuthorAvatar
                name={bundle.author_name}
                color={bundle.author_avatar_color}
                avatarUrl={bundle.author_avatar_url}
                onClick={onAuthorClick}
              />
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap" style={{ lineHeight: 1.2 }}>
                <button
                  type="button"
                  onClick={onAuthorClick}
                  className="text-[14px] font-bold text-[#1F1F1F]"
                  style={{ padding: 0, lineHeight: 1.2, background: 'none', border: 'none' }}
                >
                  {bundle.author_name || '이름 없음'}
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
            </div>

            {/* 장소 섹션 — 분리, 우측에 묶음 개수 */}
            <div className="flex items-center gap-2 mb-3">
              <IconMapPin size={14} color={KEY} stroke={2} className="flex-shrink-0" />
              <p
                className="flex-1 min-w-0 text-[13px] font-semibold text-[#1F1F1F] m-0"
                style={{
                  lineHeight: 1.3,
                  wordBreak: 'keep-all',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {bundle.place_name || '위치 정보 없음'}
              </p>
              <span
                className="flex-shrink-0 text-[11px] font-semibold"
                style={{ color: KEY_DARK, whiteSpace: 'nowrap' }}
              >
                1시간 · {total}장
              </span>
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
                      <ExifFreshIcon iso={p.exif_taken_at} size={9} />
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

// 8-10. SearchedPlaceCard — 검색한 장소 정보 카드 (지도 하단)
function SearchedPlaceCard({
  place,
  liveCount,
  onClose,
  onViewPlace,
  scopeLabel = '이 주변',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute left-3.5 right-3.5 bottom-[24px] z-20"
    >
      <div
        className="relative max-w-[414px] mx-auto bg-white overflow-hidden"
        style={{ borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-2.5 right-2.5 flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            minWidth: 28,
            minHeight: 28,
            borderRadius: '50%',
            background: '#F5F7FA',
            border: 'none',
            padding: 0,
          }}
        >
          <IconX size={14} color="#6B6B6B" stroke={2.2} />
        </button>

        <div className="p-4 pb-3">
          <div className="flex items-start gap-2.5 pr-8">
            <div
              className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: KEY_LIGHT }}
            >
              <IconMapPin size={18} color={KEY_DARK} stroke={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p
                  className="text-[15px] font-bold text-[#1F1F1F] m-0"
                  style={{ lineHeight: 1.3, wordBreak: 'keep-all' }}
                >
                  {place.name}
                </p>
                {place.category && (
                  <span
                    className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: KEY_LIGHT, color: KEY_DARK }}
                  >
                    {place.category}
                  </span>
                )}
              </div>
              {place.address && (
                <p className="text-[11px] text-[#6B6B6B] m-0 mt-0.5 truncate">
                  {place.address}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-[#F5F7FA]">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: liveCount > 0 ? KEY : '#D8D8D8' }}
            />
            <span className="text-[12px] text-[#6B6B6B]">
              {liveCount > 0
                ? `최근 48시간 ${scopeLabel} 라이브 ${liveCount}장`
                : `아직 ${scopeLabel} 라이브 사진이 없어요`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewPlace}
          className="w-full text-white py-2.5 text-[13px] font-semibold flex items-center justify-center gap-1.5"
          style={{ background: KEY }}
        >
          이 장소 페이지 보기
          <IconArrowRight size={14} />
        </button>
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

/**
 * 묶음 작성자들의 프로필 사진(avatar_url)을 profiles 에서 한 번에 조회해 캐시.
 * RPC 가 avatar 를 주지 않으므로 핀/미리보기에서 실제 프로필 사진을 보여주기 위함.
 * 반환: { [author_id]: avatar_url | '' }
 */
function useBundleAvatars(bundles) {
  const [avatars, setAvatars] = useState({});
  const seenRef = useRef(new Set());

  useEffect(() => {
    const ids = Array.from(
      new Set(
        (bundles || [])
          .map((b) => (b?.author_id != null ? String(b.author_id) : ''))
          .filter(Boolean),
      ),
    ).filter((id) => !seenRef.current.has(id));
    if (ids.length === 0) return undefined;

    ids.forEach((id) => seenRef.current.add(id));
    let cancelled = false;
    (async () => {
      try {
        const profiles = await fetchProfilesByIdsSupabase(ids);
        if (cancelled) return;
        setAvatars((prev) => {
          const next = { ...prev };
          for (const id of ids) if (!(id in next)) next[id] = ''; // 조회 완료 표시(폴백)
          for (const p of profiles || []) {
            if (p?.id) next[String(p.id)] = p.avatar_url || '';
          }
          return next;
        });
      } catch (e) {
        logger.warn('프로필 사진 조회 실패', e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundles]);

  return avatars;
}

/**
 * Supabase에 있지만 좌표가 없는 최근 48h 게시물을 가져와서
 * place_name을 카카오 Places로 지오코드 → 핀으로 보여주는 폴백.
 * 결과는 백그라운드로 posts.exif_data.map_pin에 백필되어 다음부터는 RPC가 직접 반환.
 */
function useGeocodedPosts(bounds, category) {
  const [extraBundles, setExtraBundles] = useState([]);

  useEffect(() => {
    if (!bounds) return undefined;
    let cancelled = false;
    const cache = getGeoCache();

    (async () => {
      try {
        // 최근 48h 게시물 50건
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        let q = supabase
          .from('posts')
          .select(
            'id, user_id, content, place_name, region, category, captured_at, created_at, exif_data, images, author_username, likes_count, comments_count',
          )
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(50);
        if (category && category !== 'all') q = q.eq('category', category);
        const { data: rows, error } = await q;
        if (error) {
          logger.warn('지오코딩 폴백 fetch 실패', error.message || error);
          return;
        }
        if (cancelled || !Array.isArray(rows)) return;

        // 좌표 없는 것만
        const needCoords = rows.filter((p) => {
          const e = p?.exif_data || {};
          const lat =
            e?.map_pin?.lat ?? e.lat ?? e.gpsLatitude ?? null;
          return !Number.isFinite(Number(lat));
        });

        const synth = [];
        for (const p of needCoords) {
          if (cancelled) return;
          const query = String(p.place_name || p.region || '').trim();
          if (!query) continue;

          let coords = cache.get(query);
          if (coords === undefined) {
            coords = await searchPlaceWithKakaoFirst(query);
            cache.set(query, coords || null);
          }
          if (!coords || !Number.isFinite(coords.lat)) continue;

          // 뷰포트 안만
          if (
            coords.lat < bounds.sw.lat ||
            coords.lat > bounds.ne.lat ||
            coords.lng < bounds.sw.lng ||
            coords.lng > bounds.ne.lng
          ) {
            continue;
          }

          // 합성 bundle (단일)
          const thumb = Array.isArray(p.images)
            ? typeof p.images[0] === 'string'
              ? p.images[0]
              : ''
            : '';
          synth.push({
            bundle_id: `geo_${p.id}`,
            primary_post_id: p.id,
            primary_thumbnail: thumb,
            primary_lat: coords.lat,
            primary_lng: coords.lng,
            primary_taken_at: p.captured_at || p.created_at,
            category: p.category,
            bundle_count: 1,
            is_bundle: false,
            author_id: p.user_id,
            author_name: p.author_username || '익명',
            author_avatar_color: '#4DB8E8',
            is_author_on_site: false,
            place_name: p.place_name || p.region || '',
            body: p.content || '',
            likes_count: Number(p.likes_count) || 0,
            comments_count: Number(p.comments_count) || 0,
            saves_count: 0,
          });

          // 백그라운드 백필 (지속화) — posts UPDATE 는 owner-only RLS 라,
          // 비소유자 글도 핀 좌표만 안전하게 병합하는 definer RPC 사용.
          const _pid = typeof p.id === 'string' ? p.id : '';
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(_pid)) {
            void supabase.rpc('backfill_post_map_pin', {
              p_post_id: _pid,
              p_lat: coords.lat,
              p_lng: coords.lng,
            });
          }
        }

        if (!cancelled) setExtraBundles(synth);
      } catch (e) {
        if (!cancelled) logger.warn('지오코딩 폴백 예외', e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bounds, category]);

  return { extraBundles };
}

// 작성자 이름이 비어있거나 익명일 때 profiles 에서 다시 보강
function useAuthorFallback(bundle) {
  const [profile, setProfile] = useState(null);
  const authorId = bundle?.author_id || null;
  const needs = bundle ? isAnonymousName(bundle.author_name) : false;
  useEffect(() => {
    if (!authorId || !needs) {
      setProfile(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const p = await fetchProfileByIdSupabase(authorId);
      if (!cancelled) setProfile(p);
    })();
    return () => { cancelled = true; };
  }, [authorId, needs]);
  return profile;
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
// 같은(거의 동일한) 좌표에 묶음이 여러 개면 핀이 겹쳐 보인다.
// 겹치는 묶음들을 작은 원형으로 펼쳐(spiderfy) 표시 위치를 분리한다.
//   - 실제 좌표는 그대로 두고 "표시 위치"만 픽셀 단위로 분산 → 클릭 시 원래 위치로 이동.
//   - 클러스터링(level>=6) 중엔 펼치지 않는다.
// 반환: Map<bundle_id, {lat, lng}>
// ────────────────────────────────────────────────
function computeFanoutPositions(kakao, map, bundles, useClustering) {
  const result = new Map();
  for (const b of bundles) {
    result.set(b.bundle_id, { lat: b.primary_lat, lng: b.primary_lng });
  }
  if (useClustering || bundles.length < 2) return result;

  let proj = null;
  try {
    proj = map.getProjection();
  } catch {
    proj = null;
  }

  // 좌표 반올림(약 1m) 키로 그룹화
  const groups = new Map();
  for (const b of bundles) {
    if (b.primary_lat == null || b.primary_lng == null) continue;
    const key = `${Number(b.primary_lat).toFixed(5)},${Number(b.primary_lng).toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // 핀이 겹치지 않도록 개수에 따라 반경(px)을 키운다
    const radiusPx = 30 + Math.min(group.length, 8) * 4;
    const base = group[0];
    const baseLatLng = new kakao.maps.LatLng(base.primary_lat, base.primary_lng);
    let basePt = null;
    if (proj) {
      try {
        basePt = proj.pointFromCoords(baseLatLng);
      } catch {
        basePt = null;
      }
    }

    group.forEach((b, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      if (basePt && proj) {
        try {
          const pt = new kakao.maps.Point(
            basePt.x + Math.cos(angle) * radiusPx,
            basePt.y + Math.sin(angle) * radiusPx,
          );
          const ll = proj.coordsFromPoint(pt);
          result.set(b.bundle_id, { lat: ll.getLat(), lng: ll.getLng() });
          return;
        } catch {
          /* projection 실패 시 도(degree) 오프셋 폴백 */
        }
      }
      const r = 0.00008;
      result.set(b.bundle_id, {
        lat: b.primary_lat + Math.cos(angle) * r,
        lng: b.primary_lng + Math.sin(angle) * r,
      });
    });
  }

  return result;
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
  const searchPinOverlayRef = useRef(null);
  const regionPolygonsRef = useRef([]);
  const clustererRef = useRef(null);
  const idleListenerRef = useRef(null);
  const clickListenerRef = useRef(null);
  const didInitialCenterRef = useRef(false); // 첫 진입 시 1회만 내 위치로 이동

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const [bounds, setBounds] = useState(null);
  const [mapLevel, setMapLevel] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBundleId, setSelectedBundleId] = useState(null);

  // 지도 내 장소 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState(null);
  const [searchedRegion, setSearchedRegion] = useState(null);
  const {
    results: placeResults,
    loading: placeLoading,
    search: searchPlaces,
  } = useKakaoPlaceSearch();

  // 행정구역(시·도/시·군·구) 매치 — 로컬 인덱스라 동기 계산
  const regionMatches = useMemo(
    () => (searchFocused ? searchRegions(searchQuery) : []),
    [searchQuery, searchFocused],
  );

  const { coords: myLocation, requestLocation } = useGeolocation();
  const { bundles: rpcBundles } = useMapBundles(bounds, selectedCategory);
  const { extraBundles } = useGeocodedPosts(bounds, selectedCategory);

  // RPC가 반환한 묶음 + 지오코딩 폴백 묶음 병합 (중복 제거)
  const baseBundles = useMemo(() => {
    const map = new Map();
    for (const b of rpcBundles) map.set(String(b.primary_post_id), b);
    for (const b of extraBundles) {
      const id = String(b.primary_post_id);
      if (!map.has(id)) map.set(id, b);
    }
    return Array.from(map.values());
  }, [rpcBundles, extraBundles]);

  // get_map_bundles RPC 는 작성자 프로필 사진을 주지 않으므로 client 에서 보강
  const avatarMap = useBundleAvatars(baseBundles);
  const bundles = useMemo(
    () =>
      baseBundles.map((b) => ({
        ...b,
        author_avatar_url:
          avatarMap[String(b.author_id)] ?? b.author_avatar_url ?? null,
      })),
    [baseBundles, avatarMap],
  );

  const selectedBundleRaw = useMemo(
    () => bundles.find((b) => b.bundle_id === selectedBundleId) || null,
    [bundles, selectedBundleId],
  );
  const fallbackProfile = useAuthorFallback(selectedBundleRaw);
  const selectedBundle = useMemo(() => {
    if (!selectedBundleRaw) return null;
    if (!fallbackProfile) return selectedBundleRaw;
    const resolvedName =
      (fallbackProfile.nickname && String(fallbackProfile.nickname).trim()) ||
      (fallbackProfile.username && String(fallbackProfile.username).trim()) ||
      (fallbackProfile.display_name && String(fallbackProfile.display_name).trim()) ||
      selectedBundleRaw.author_name;
    // 프로필 보강 fetch 에 avatar 가 있으면 우선 사용 (상세 카드에서 프로필 사진 보장)
    const resolvedAvatar =
      fallbackProfile.avatar_url || selectedBundleRaw.author_avatar_url || null;
    return { ...selectedBundleRaw, author_name: resolvedName, author_avatar_url: resolvedAvatar };
  }, [selectedBundleRaw, fallbackProfile]);
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

    const onClick = () => {
      setSelectedBundleId(null);
      setSearchFocused(false);
    };
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

    // 같은 좌표 묶음들을 겹치지 않게 펼친 "표시 위치"
    const fanoutPos = computeFanoutPositions(kakao, map, bundles, useClustering);
    const posOf = (bundle) =>
      fanoutPos.get(bundle.bundle_id) || {
        lat: bundle.primary_lat,
        lng: bundle.primary_lng,
      };

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

      const rpos = posOf(bundle);

      const existing = overlayMapRef.current.get(id);
      if (existing) {
        existing.wrap.innerHTML = innerHtml;
        existing.wrap.style.display = display;
        try {
          existing.overlay.setPosition(new kakao.maps.LatLng(rpos.lat, rpos.lng));
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
          // 묶음 핀(여러 게시물)이면 한 단계 더 가까이 들어가 게시물들이 펼쳐져 보이게
          if (bundle.is_bundle) {
            const curLevel = typeof map.getLevel === 'function' ? map.getLevel() : 5;
            const nextLevel = Math.max(2, curLevel - 2);
            if (typeof map.setLevel === 'function' && nextLevel < curLevel) {
              map.setLevel(nextLevel, {
                anchor: new kakao.maps.LatLng(bundle.primary_lat, bundle.primary_lng),
                animate: true,
              });
            }
          }
        } catch {
          /* ignore */
        }
      });

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(rpos.lat, rpos.lng),
        content: wrap,
        yAnchor: 1,
        xAnchor: 0.5,
        zIndex: isSelected ? 5 : 3,
        clickable: true,
      });
      overlay.setMap(map);
      overlayMapRef.current.set(id, { overlay, wrap });
    });

    // 클러스터러 (level >= 6) — 네모박스에 통합 사진 개수 표시
    try {
      const Clusterer = window.kakao?.maps?.MarkerClusterer;
      if (Clusterer) {
        if (!clustererRef.current) {
          clustererRef.current = new Clusterer({
            map,
            averageCenter: true,
            minLevel: 6,
            gridSize: 60,
            // 단일 마커도 카카오 기본 핀이 아니라 우리 네모 카운트 박스로 보이게
            minClusterSize: 1,
            disableClickZoom: true, // 직접 줌 처리 (더 세부적으로 분할)
            styles: [
              {
                // 1~9장: 작은 흰 네모박스 + 키컬러 테두리
                width: '36px',
                height: '36px',
                background: '#ffffff',
                border: `2px solid ${KEY}`,
                borderRadius: '8px',
                color: '#1F1F1F',
                textAlign: 'center',
                fontWeight: '800',
                fontSize: '13px',
                lineHeight: '32px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.14)',
              },
              {
                // 10~49장: 중간 흰 네모박스
                width: '44px',
                height: '44px',
                background: '#ffffff',
                border: `2px solid ${KEY}`,
                borderRadius: '8px',
                color: '#1F1F1F',
                textAlign: 'center',
                fontWeight: '800',
                fontSize: '14px',
                lineHeight: '40px',
                boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
              },
              {
                // 50장+: 키컬러 채움 네모박스
                width: '52px',
                height: '52px',
                background: KEY,
                border: '2px solid #ffffff',
                borderRadius: '10px',
                color: '#ffffff',
                textAlign: 'center',
                fontWeight: '800',
                fontSize: '15px',
                lineHeight: '48px',
                boxShadow: '0 4px 14px rgba(77,184,232,0.45)',
              },
            ],
            calculator: [10, 50],
          });

          // 클러스터 클릭 시: 한 번에 충분히 줌인하여 세부 분할/사진이 보이게
          try {
            kakao.maps.event.addListener(
              clustererRef.current,
              'clusterclick',
              (cluster) => {
                const curLevel = typeof map.getLevel === 'function' ? map.getLevel() : 7;
                // 현재 6 이상이면 5 이하로 한 번에 내려가서 사진 핀이 보이도록
                const nextLevel = curLevel >= 8 ? Math.max(4, curLevel - 3) : Math.max(3, curLevel - 2);
                try {
                  map.setLevel(nextLevel, {
                    anchor: cluster.getCenter(),
                    animate: true,
                  });
                } catch {
                  try { map.setLevel(nextLevel); } catch { /* ignore */ }
                  try { map.panTo(cluster.getCenter()); } catch { /* ignore */ }
                }
              },
            );
          } catch {
            /* ignore */
          }
        }
        clustererRef.current.clear();
        if (useClustering) {
          // 묶음(bundle_count) 만큼의 마커를 생성해 클러스터 숫자가 실제 사진 통합 개수가 되도록
          const markers = [];
          bundles.forEach((b) => {
            const count = Math.max(1, Number(b.bundle_count) || 1);
            const pos = new kakao.maps.LatLng(b.primary_lat, b.primary_lng);
            for (let i = 0; i < count; i += 1) {
              markers.push(new kakao.maps.Marker({ position: pos }));
            }
          });
          clustererRef.current.addMarkers(markers);
        }
      }
    } catch {
      /* ignore */
    }
  }, [bundles, selectedBundleId, mapLevel]);

  // 3-2) 진입 시 첫 GPS 수신되면 지도를 거기로 1회만 이동
  //   - 사용자가 지도를 직접 옮긴 뒤 GPS 가 다시 갱신돼도 끌려가지 않게 ref 가드.
  //   - GPS 거부/실패로 DEFAULT_CENTER 가 들어와도 그대로 두면 됨 (이미 그 위치).
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps || !myLocation) return;
    if (didInitialCenterRef.current) return;
    // 폴백 좌표면 그대로 둠 (서울 시청)
    if (
      myLocation.lat === DEFAULT_CENTER.lat &&
      myLocation.lng === DEFAULT_CENTER.lng
    ) {
      didInitialCenterRef.current = true;
      return;
    }
    try {
      map.setCenter(
        new window.kakao.maps.LatLng(myLocation.lat, myLocation.lng),
      );
      didInitialCenterRef.current = true;
    } catch {
      /* ignore */
    }
  }, [myLocation, sdkReady]);

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

  // 5) 검색한 장소 핀 오버레이
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return undefined;
    if (searchPinOverlayRef.current) {
      try {
        searchPinOverlayRef.current.setMap(null);
      } catch {
        /* ignore */
      }
      searchPinOverlayRef.current = null;
    }
    if (!searchedPlace) return undefined;
    const kakao = window.kakao;
    const wrap = document.createElement('div');
    wrap.innerHTML = buildSearchPinHTML();
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(searchedPlace.lat, searchedPlace.lng),
      content: wrap,
      yAnchor: 1,
      xAnchor: 0.5,
      zIndex: 6,
    });
    overlay.setMap(map);
    searchPinOverlayRef.current = overlay;
    return () => {
      try {
        overlay.setMap(null);
      } catch {
        /* ignore */
      }
      searchPinOverlayRef.current = null;
    };
  }, [searchedPlace, sdkReady]);

  // 6) 검색한 지역(행정구역) 경계 폴리곤 — 지역 전체 테두리 + 지도 맞춤
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return undefined;

    // 기존 경계 제거
    for (const poly of regionPolygonsRef.current) {
      try {
        poly.setMap(null);
      } catch {
        /* ignore */
      }
    }
    regionPolygonsRef.current = [];
    if (!searchedRegion) return undefined;

    let cancelled = false;
    (async () => {
      const rings = await loadRegionRings(searchedRegion);
      if (cancelled || !rings) return;
      const kakao = window.kakao;
      const map2 = kakaoMapRef.current;
      if (!map2 || !kakao?.maps) return;

      const fitBounds = new kakao.maps.LatLngBounds();
      for (const ring of rings) {
        const path = ring.map((pt) => {
          const ll = new kakao.maps.LatLng(pt.lat, pt.lng);
          fitBounds.extend(ll);
          return ll;
        });
        const polygon = new kakao.maps.Polygon({
          map: map2,
          path,
          strokeWeight: 3,
          strokeColor: KEY,
          strokeOpacity: 0.95,
          strokeStyle: 'solid',
          fillColor: KEY,
          fillOpacity: 0.08,
          zIndex: 2,
        });
        regionPolygonsRef.current.push(polygon);
      }
      // 지역 전체가 화면에 들어오게 (상단 헤더/하단 카드 여백 고려)
      try {
        map2.setBounds(fitBounds, 120, 36, 200, 36);
      } catch {
        try {
          map2.setBounds(fitBounds);
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const poly of regionPolygonsRef.current) {
        try {
          poly.setMap(null);
        } catch {
          /* ignore */
        }
      }
      regionPolygonsRef.current = [];
    };
  }, [searchedRegion, sdkReady]);

  // 검색 입력 → 카카오 장소 자동완성
  const handleSearchChange = useCallback(
    (v) => {
      setSearchQuery(v);
      setSearchFocused(true);
      searchPlaces(v);
    },
    [searchPlaces],
  );

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setSearchFocused(false);
    setSearchedPlace(null);
    setSearchedRegion(null);
    searchPlaces('');
  }, [searchPlaces]);

  // 새로고침 — 현재 보고 있는 지도 영역의 묶음(라이브 사진)을 다시 불러온다.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    const map = kakaoMapRef.current;
    if (!map || refreshing) return;
    setRefreshing(true);
    setSelectedBundleId(null);
    try {
      const b = map.getBounds();
      // bounds 객체를 새로 만들어 useMapBundles 의 refetch 를 강제
      setBounds({
        sw: { lat: b.getSouthWest().getLat(), lng: b.getSouthWest().getLng() },
        ne: { lat: b.getNorthEast().getLat(), lng: b.getNorthEast().getLng() },
      });
    } catch {
      /* ignore */
    }
    // RPC 디바운스(300ms) + 네트워크를 감안해 잠깐 회전 표시
    window.setTimeout(() => setRefreshing(false), 900);
  }, [refreshing]);

  // 검색 결과 선택 → 지도 이동 + 장소 카드 표시 (화면 전환 없음)
  const handleSelectPlace = useCallback((place) => {
    setSearchedPlace(place);
    setSearchedRegion(null);
    setSearchQuery(place.name);
    setSearchFocused(false);
    setSelectedBundleId(null);
    const map = kakaoMapRef.current;
    if (map && window.kakao?.maps) {
      try {
        if (map.getLevel() > 4) map.setLevel(4);
        map.setCenter(new window.kakao.maps.LatLng(place.lat, place.lng));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // 지역(행정구역) 선택 → 경계 그리기는 위 effect가 담당
  const handleSelectRegion = useCallback(
    (region) => {
      setSearchedRegion(region);
      setSearchedPlace(null);
      setSearchQuery(region.displayName || region.name);
      setSearchFocused(false);
      setSelectedBundleId(null);
      searchPlaces('');
    },
    [searchPlaces],
  );

  // 검색 장소 반경 500m 내 라이브 사진 수 (현재 뷰포트 묶음 기준)
  // 지역 검색일 때는 뷰포트(≈지역 전체)의 라이브 수 합산
  const liveNearCount = useMemo(() => {
    if (searchedRegion) {
      let total = 0;
      for (const b of bundles) total += Math.max(1, Number(b.bundle_count) || 1);
      return total;
    }
    if (!searchedPlace) return 0;
    let total = 0;
    for (const b of bundles) {
      if (!Number.isFinite(b.primary_lat) || !Number.isFinite(b.primary_lng)) {
        continue;
      }
      const d = distMeters(searchedPlace, {
        lat: b.primary_lat,
        lng: b.primary_lng,
      });
      if (d <= 500) total += Math.max(1, Number(b.bundle_count) || 1);
    }
    return total;
  }, [bundles, searchedPlace, searchedRegion]);

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

      <MapSearchHeader
        query={searchQuery}
        onQueryChange={handleSearchChange}
        results={placeResults}
        regions={regionMatches}
        loading={placeLoading}
        showResults={searchFocused && !!searchQuery.trim()}
        onFocus={() => setSearchFocused(true)}
        onSelect={handleSelectPlace}
        onSelectRegion={handleSelectRegion}
        onClear={handleSearchClear}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
      <MapCategoryFilter
        selected={selectedCategory}
        onChange={setSelectedCategory}
      />
      <MyLocationButton
        onClick={handleMyLocation}
        raised={!!(searchedPlace || searchedRegion) && !selectedBundleId}
      />

      <AnimatePresence>
        {searchedPlace && !selectedBundleId && (
          <SearchedPlaceCard
            key={`search-${searchedPlace.kakao_id}`}
            place={searchedPlace}
            liveCount={liveNearCount}
            onClose={handleSearchClear}
            onViewPlace={() =>
              navigate(`/region/${encodeURIComponent(searchedPlace.name)}`)
            }
          />
        )}
        {searchedRegion && !selectedBundleId && (
          <SearchedPlaceCard
            key={`region-${searchedRegion.code}`}
            place={{
              name: searchedRegion.displayName || searchedRegion.name,
              address: searchedRegion.province || '대한민국',
              category: '지역 전체',
            }}
            scopeLabel="지역 내"
            liveCount={liveNearCount}
            onClose={handleSearchClear}
            onViewPlace={() =>
              navigate(
                `/region/${encodeURIComponent(
                  searchedRegion.displayName || searchedRegion.name,
                )}`,
              )
            }
          />
        )}
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
