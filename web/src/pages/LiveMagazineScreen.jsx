import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconBulb, IconMessage } from '@tabler/icons-react';
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

      {/* 큰 타이틀 */}
      <div style={{ padding: '20px 18px 14px' }}>
        <h1
          className="m-0"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: TEXT_PRIMARY,
            lineHeight: 1.35,
            letterSpacing: -0.4,
          }}
        >
          {magazine.title}
        </h1>
        {magazine.subtitle && (
          <p
            className="m-0"
            style={{ marginTop: 6, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}
          >
            {magazine.subtitle}
          </p>
        )}
        {magazine.intro_body && (
          <p
            className="m-0"
            style={{
              marginTop: 12,
              fontSize: 13,
              color: TEXT_PRIMARY,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
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
        <>
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
                <PlaceCard place={p} index={idx + 1} />
              </div>
            ))}
          </div>

          {/* 페이지 도트 */}
          <div className="flex items-center justify-center gap-1.5" style={{ padding: '14px 0 8px' }}>
            {placePages.map((_, idx) => (
              <span
                key={idx}
                style={{
                  width: idx === pageIdx ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: idx === pageIdx ? KEY : '#E5E7EB',
                  transition: 'width 0.2s ease, background 0.2s ease',
                }}
              />
            ))}
          </div>
        </>
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

function PlaceCard({ place, index }) {
  return (
    <div
      style={{
        marginTop: 4,
        marginBottom: 8,
        border: `1px solid ${BORDER_LIGHT}`,
        borderRadius: 16,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      {/* 헤더 영역 (장소 N + 제목 + 위치 정보) */}
      <div style={{ padding: '18px 18px 12px' }}>
        <p
          className="m-0"
          style={{ fontSize: 12, fontWeight: 700, color: KEY, marginBottom: 6 }}
        >
          장소 {index}
        </p>
        <h2
          className="m-0"
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: TEXT_PRIMARY,
            lineHeight: 1.35,
            letterSpacing: -0.3,
          }}
        >
          {place.description?.split('\n')[0] || place.name}
        </h2>

        <div style={{ marginTop: 14 }}>
          <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 2 }}>
            위치이름
          </p>
          <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
            {place.name || '이름 없음'}
          </p>
        </div>

        {place.address && (
          <div style={{ marginTop: 10 }}>
            <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 2 }}>
              위치정보
            </p>
            <p className="m-0" style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
              {place.address}
            </p>
          </div>
        )}
      </div>

      {/* 큰 이미지 */}
      {place.image_url ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: SURFACE }}>
          <img
            src={getDisplayImageUrl(place.image_url)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <PlaceLiveBadge placeName={place.name} />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '4 / 3',
            background: SURFACE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT_TERTIARY,
            fontSize: 12,
          }}
        >
          사진 없음
        </div>
      )}

      {/* 본문 */}
      <div style={{ padding: '18px 18px 8px' }}>
        <p
          className="m-0"
          style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10 }}
        >
          장소설명
        </p>
        <p
          className="m-0"
          style={{
            fontSize: 13,
            lineHeight: 1.75,
            color: TEXT_PRIMARY,
            whiteSpace: 'pre-wrap',
          }}
        >
          {place.description || '설명이 없습니다.'}
        </p>

        <div style={{ borderTop: `1px solid ${BORDER_LIGHT}`, margin: '18px 0 14px' }} />

        <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
          <IconBulb size={14} color={KEY} stroke={2} />
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>실시간 여행팁</span>
        </div>
        <TipPill tip={place.tip} />

        <AskQuestionCTA placeName={place.name} />

        <div style={{ borderTop: `1px solid ${BORDER_LIGHT}`, margin: '18px 0 14px' }} />

        <LivePhotosSection placeName={place.name} />
      </div>
    </div>
  );
}

function TipPill({ tip }) {
  if (!tip) {
    return (
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 999,
          border: `1px solid ${BORDER_LIGHT}`,
          background: '#fff',
          color: TEXT_TERTIARY,
          fontSize: 12,
        }}
      >
        아직 공유된 실시간 팁이 없어요. 첫 번째 한마디를 남겨보세요!
      </div>
    );
  }
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: KEY_LIGHT,
        color: KEY_DARK,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {tip}
    </div>
  );
}

function AskQuestionCTA({ placeName }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() =>
        navigate(`/question/new${placeName ? `?place=${encodeURIComponent(placeName)}` : ''}`)
      }
      className="w-full flex items-center justify-center gap-2"
      style={{
        marginTop: 14,
        height: 52,
        background: KEY_LIGHT,
        color: KEY_DARK,
        borderRadius: 14,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.4,
      }}
    >
      <IconMessage size={16} stroke={2} color={KEY_DARK} />
      <span>
        가장 많이 묻는 실시간 질문
        <br />
        바로 물어보기
      </span>
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

/**
 * 해당 장소(place_name) 에 매칭되는 실시간 사진 그리드 (최근 48시간 + 5장).
 */
function LivePhotosSection({ placeName }) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placeName) return undefined;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('lj_posts')
          .select('id, photo_url, exif_taken_at')
          .eq('place_name', placeName)
          .gt('exif_taken_at', cutoff)
          .order('exif_taken_at', { ascending: false })
          .limit(6);
        if (cancelled) return;
        if (error) {
          logger.warn('live photos fetch 실패', error.message || error);
          setPhotos([]);
        } else {
          setPhotos(Array.isArray(data) ? data : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeName]);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          실시간으로 올라오는 사진
        </span>
        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(`/region/${encodeURIComponent(placeName || '')}`)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              color: KEY,
            }}
          >
            전체보기
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center" style={{ fontSize: 12, color: TEXT_SECONDARY, padding: '12px 0' }}>
          불러오는 중...
        </p>
      ) : photos.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_TERTIARY, padding: '12px 0' }}>
          이 장소와 맞는 사진이 아직 없어요.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 6,
          }}
        >
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/post/${encodeURIComponent(p.id)}`)}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 8,
                overflow: 'hidden',
                background: SURFACE,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              {p.photo_url && (
                <img
                  src={getDisplayImageUrl(p.photo_url)}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
