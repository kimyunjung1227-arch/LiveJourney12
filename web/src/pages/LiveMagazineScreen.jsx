import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconBulb,
  IconMessage,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import { fetchMagazineById } from '../api/curatedMagazinesSupabase';
import { supabase } from '../utils/supabaseClient';
import { getDisplayImageUrl } from '../api/upload';
import BottomNavigation from '../components/BottomNavigation';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import { logger } from '../utils/logger';

const KEY = '#4DB8E8';
const KEY_LIGHT = '#E8F4FB';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_TERTIARY = '#B8B8B8';
const SURFACE = '#F5F7FA';
const BORDER_LIGHT = '#E8E8E8';

// 글 길이에 따라 한 줄로 들어갈 폰트 사이즈 자동 산정
function autoTitleSize(text) {
  const len = String(text || '').length;
  if (len <= 14) return 22;
  if (len <= 20) return 20;
  if (len <= 26) return 18;
  if (len <= 34) return 16;
  if (len <= 42) return 14;
  return 12;
}

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
 * 라이브 매거진 상세 — 큐레이션 매거진의 place 블록을
 * 한 장소 = 한 페이지 카드 형태(가로 스와이프)로 보여준다.
 * 각 장소 카드에는:
 *   - 라이브 사진(매거진에 등록된 cover) + N시간 전 뱃지(있을 때)
 *   - 장소설명
 *   - 실시간 여행팁 (place.tip 또는 빈 상태)
 *   - 가장 많이 묻는 질문 → 질문하기로 이동
 *   - 해당 장소 이름과 매칭된 실시간 사진 그리드 (lj_posts 최근 48h)
 */
export default function LiveMagazineScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [magazine, setMagazine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageIdx, setPageIdx] = useState(0);
  const carouselRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = await fetchMagazineById(id);
      if (!cancelled) {
        setMagazine(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // place 블록만 페이지로 사용
  const placePages = useMemo(() => {
    const blocks = Array.isArray(magazine?.blocks) ? magazine.blocks : [];
    return blocks.filter((b) => b && b.type === 'place');
  }, [magazine]);

  // 스크롤 위치로 현재 page index 추적
  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const next = Math.round(el.scrollLeft / w);
    setPageIdx((cur) => (cur === next ? cur : next));
  }, []);

  // 페이지 인덱스로 부드럽게 스크롤
  const scrollToPage = useCallback((idx) => {
    const el = carouselRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    el.scrollTo({ left: idx * w, behavior: 'smooth' });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: TEXT_SECONDARY }}>
        불러오는 중...
      </div>
    );
  }

  if (!magazine) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm" style={{ color: TEXT_SECONDARY }}>매거진을 찾을 수 없어요</p>
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="px-4 h-10 rounded-lg text-sm font-bold"
          style={{ background: KEY, color: '#fff' }}
        >
          검색으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <PageSeo {...(PAGE_SEO.magazine || PAGE_SEO.search)} title={magazine.title} />

      {/* 헤더 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 52,
          padding: '0 12px',
          background: '#fff',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconArrowLeft size={20} color={TEXT_PRIMARY} stroke={1.8} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>라이브매거진</span>
      </div>

      {/* 큰 타이틀 — 한 줄 + 글 길이에 따라 자동 축소 */}
      <div style={{ padding: '16px 18px 10px' }}>
        <h1
          className="m-0"
          style={{
            fontSize: autoTitleSize(magazine.title || ''),
            fontWeight: 800,
            color: TEXT_PRIMARY,
            lineHeight: 1.2,
            letterSpacing: -0.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={magazine.title}
        >
          {magazine.title}
        </h1>
        {magazine.intro_body && (
          <p
            className="m-0"
            style={{
              marginTop: 8,
              fontSize: 12.5,
              color: TEXT_SECONDARY,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {magazine.intro_body}
          </p>
        )}
      </div>

      {/* 장소 페이지 가로 스와이프 */}
      {placePages.length === 0 ? (
        <EmptyPlaces />
      ) : (
        <div style={{ position: 'relative' }}>
          <div
            ref={carouselRef}
            onScroll={onScroll}
            style={{
              display: 'flex',
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            className="hide-scrollbar"
          >
            {placePages.map((p, idx) => (
              <div
                key={idx}
                style={{
                  flex: '0 0 100%',
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                  padding: '0 18px',
                }}
              >
                <PlaceCard place={p} index={idx + 1} total={placePages.length} />
              </div>
            ))}
          </div>

          {/* 좌/우 네비게이션 화살표 (페이지 ≥ 2일 때) */}
          {placePages.length > 1 && (
            <>
              <NavArrow
                side="left"
                disabled={pageIdx <= 0}
                onClick={() => scrollToPage(Math.max(0, pageIdx - 1))}
              />
              <NavArrow
                side="right"
                disabled={pageIdx >= placePages.length - 1}
                onClick={() =>
                  scrollToPage(Math.min(placePages.length - 1, pageIdx + 1))
                }
              />
            </>
          )}

        </div>
      )}

      <BottomNavigation />
    </div>
  );
}

function EmptyPlaces() {
  return (
    <div
      className="text-center"
      style={{ margin: '24px 18px', padding: 32, borderRadius: 14, background: SURFACE, color: TEXT_SECONDARY, fontSize: 13 }}
    >
      이 매거진에는 아직 장소가 등록되지 않았어요
    </div>
  );
}

function NavArrow({ side, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? '이전 장소' : '다음 장소'}
      style={{
        position: 'absolute',
        top: 130,
        [side]: 6,
        width: 34,
        height: 34,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.92)',
        border: `1px solid ${BORDER_LIGHT}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        display: disabled ? 'none' : 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        zIndex: 5,
      }}
    >
      {side === 'left' ? (
        <IconChevronLeft size={20} color={KEY_DARK} stroke={2.2} />
      ) : (
        <IconChevronRight size={20} color={KEY_DARK} stroke={2.2} />
      )}
    </button>
  );
}

function PlaceCard({ place, index }) {
  const placeImageUrl = useFallbackPlaceImage(place);

  return (
    <div
      style={{
        marginTop: 2,
        marginBottom: 4,
        border: `1px solid ${BORDER_LIGHT}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      {/* 헤더 영역 */}
      <div style={{ padding: '12px 14px 8px' }}>
        <p
          className="m-0"
          style={{ fontSize: 11, fontWeight: 700, color: KEY, marginBottom: 4 }}
        >
          장소 {index}
        </p>
        <p
          className="m-0"
          style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRIMARY, lineHeight: 1.3 }}
        >
          {place.name || '이름 없음'}
        </p>
        {place.address && (
          <p
            className="m-0"
            style={{
              marginTop: 2,
              fontSize: 11,
              color: TEXT_SECONDARY,
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {place.address}
          </p>
        )}
      </div>

      {/* 이미지 (place.image_url 있으면 그것, 없으면 lj_posts 매칭 자동 fallback) */}
      {placeImageUrl ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            background: SURFACE,
          }}
        >
          <img
            src={placeImageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <PlaceLiveBadge placeName={place.name} />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            background: SURFACE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT_TERTIARY,
            fontSize: 11,
          }}
        >
          아직 등록된 사진이 없어요
        </div>
      )}

      {/* 본문 — 컴팩트 */}
      <div style={{ padding: '12px 14px 12px' }}>
        <p
          className="m-0"
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: TEXT_PRIMARY,
            whiteSpace: 'pre-wrap',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {place.description || '설명이 없습니다.'}
        </p>

        {place.tip && (
          <div
            className="flex items-start gap-1.5"
            style={{
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: 10,
              background: KEY_LIGHT,
            }}
          >
            <IconBulb size={13} color={KEY_DARK} stroke={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: KEY_DARK, lineHeight: 1.5 }}>
              {place.tip}
            </span>
          </div>
        )}

        <AskQuestionCTA placeName={place.name} compact />
      </div>
    </div>
  );
}

/**
 * place.image_url 이 있으면 그대로, 없으면 lj_posts 또는 posts 에서
 * place_name 매칭되는 가장 최근 사진을 가져온다.
 */
function useFallbackPlaceImage(place) {
  const [url, setUrl] = useState(place?.image_url ? getDisplayImageUrl(place.image_url) : '');
  useEffect(() => {
    if (place?.image_url) {
      setUrl(getDisplayImageUrl(place.image_url));
      return undefined;
    }
    if (!place?.name) {
      setUrl('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        // 1) lj_posts 우선
        const { data: ljRow } = await supabase
          .from('lj_posts')
          .select('photo_url')
          .eq('place_name', place.name)
          .order('exif_taken_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (ljRow?.photo_url) {
          setUrl(getDisplayImageUrl(ljRow.photo_url));
          return;
        }
        // 2) posts 폴백 (images jsonb 첫 번째 또는 photo_url)
        const { data: pRow } = await supabase
          .from('posts')
          .select('photo_url, images')
          .eq('place_name', place.name)
          .order('captured_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        const raw =
          pRow?.photo_url ||
          (Array.isArray(pRow?.images) && typeof pRow.images[0] === 'string'
            ? pRow.images[0]
            : '');
        setUrl(raw ? getDisplayImageUrl(raw) : '');
      } catch (e) {
        logger.warn('place image fallback 실패', e?.message || e);
        if (!cancelled) setUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [place?.image_url, place?.name]);
  return url;
}

function AskQuestionCTA({ placeName, compact = false }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() =>
        navigate(`/question/new${placeName ? `?place=${encodeURIComponent(placeName)}` : ''}`)
      }
      className="w-full flex items-center justify-center gap-1.5"
      style={{
        marginTop: compact ? 10 : 14,
        height: compact ? 38 : 52,
        background: KEY_LIGHT,
        color: KEY_DARK,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        fontSize: compact ? 12 : 13,
        fontWeight: 700,
      }}
    >
      <IconMessage size={compact ? 13 : 16} stroke={2} color={KEY_DARK} />
      <span>이 장소에 실시간 질문하기</span>
    </button>
  );
}

/**
 * place_name 매칭 lj_posts 최근 게시물에서 가장 최근 사진의 시간만 띄움.
 */
function PlaceLiveBadge({ placeName }) {
  const [latestAt, setLatestAt] = useState(null);
  useEffect(() => {
    if (!placeName) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('lj_posts')
          .select('exif_taken_at')
          .eq('place_name', placeName)
          .order('exif_taken_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || error || !data?.exif_taken_at) return;
        setLatestAt(data.exif_taken_at);
      } catch (e) {
        logger.warn('place live badge fetch 실패', e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeName]);
  if (!latestAt) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        padding: '5px 12px',
        borderRadius: 999,
        background: KEY,
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}
    >
      {timeAgo(latestAt)}
    </div>
  );
}

