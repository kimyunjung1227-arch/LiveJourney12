import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCamera, IconMapPin, IconCheck } from '@tabler/icons-react';
import { supabase } from '../../utils/supabaseClient';
import { getDisplayImageUrl } from '../../api/upload';
import { logger } from '../../utils/logger';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_TERTIARY = '#B8B8B8';
const SURFACE = '#F5F7FA';
const KEY = '#4DB8E8';

/** images 항목(문자열 또는 {url,src,public_url,publicUrl} 객체)에서 URL 추출 */
function extractImageUrl(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    return item.url || item.src || item.public_url || item.publicUrl || '';
  }
  return '';
}

function postThumb(p) {
  const fromImages = Array.isArray(p.images) ? extractImageUrl(p.images[0]) : extractImageUrl(p.images);
  const raw = fromImages || p.photo_url || '';
  return raw ? getDisplayImageUrl(raw) : '';
}

/**
 * 한 사용자의 게시물을 최신순으로 가져온다.
 * (posts 테이블 직접 조회 — place_name/body 까지 포함)
 *
 * @param {string|null} userId 대상 사용자 UUID
 * @param {number|null} limit 가져올 개수 (null = 최대 200)
 */
export function useUserPosts(userId, limit) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(
            'id, place_name, region, content, images, photo_url, captured_at, created_at',
          )
          .eq('user_id', userId)
          .order('captured_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(limit || 200);

        if (cancelled) return;
        if (error) {
          logger.warn('user-posts fetch 실패', error.message || error);
          setPosts([]);
          return;
        }
        setPosts(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  return { posts, loading };
}

/**
 * 게시물 카드 — 가로(landscape) 사진 위 + 장소명 아래.
 * selectable=true 면 탭 시 이동 대신 선택 토글(삭제용 선택 모드).
 */
function PostRow({ post, selectable = false, selected = false, onToggle }) {
  const navigate = useNavigate();
  const thumb = postThumb(post);
  const place = post.place_name || post.region || '';

  const handleClick = () => {
    if (selectable) {
      onToggle?.(post.id);
    } else {
      navigate(`/post/${encodeURIComponent(post.id)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selectable ? selected : undefined}
      className="text-left"
      style={{
        width: '100%',
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {/* 사진 — 정사각형 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 10,
          background: SURFACE,
          overflow: 'hidden',
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <IconCamera size={22} color={TEXT_TERTIARY} stroke={1.6} />
          </div>
        )}
        {selectable && (
          <>
            {selected && (
              <div
                className="absolute inset-0"
                style={{ background: 'rgba(77,184,232,0.32)' }}
              />
            )}
            <div
              className="absolute flex items-center justify-center"
              style={{
                top: 6,
                left: 6,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: selected ? KEY : 'rgba(255,255,255,0.85)',
                border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              {selected && <IconCheck size={14} color="#fff" stroke={3} />}
            </div>
          </>
        )}
      </div>

      {/* 장소명 (사진 아래) */}
      <div className="flex items-center" style={{ gap: 4, marginTop: 7 }}>
        <IconMapPin size={13} color={KEY} stroke={2} style={{ flexShrink: 0 }} />
        <span
          className="min-w-0"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {place || '어딘가의 순간'}
        </span>
      </div>
    </button>
  );
}

/**
 * 사용자가 올린 게시물을 행(行) 리스트로 렌더.
 * 프로필 미리보기(3개)와 전체보기 화면에서 공용으로 쓴다.
 *
 * @param {object} props
 * @param {Array} props.posts 표시할 게시물 배열
 * @param {boolean} [props.selectable] 선택 모드 (삭제용)
 * @param {Set<string>} [props.selectedIds] 선택된 게시물 id 집합
 * @param {(id:string)=>void} [props.onToggleSelect] 선택 토글
 */
export default function UserPostsList({
  posts,
  selectable = false,
  selectedIds,
  onToggleSelect,
  horizontal = false,
}) {
  const list = Array.isArray(posts) ? posts : [];
  if (list.length === 0) {
    return (
      <div className="text-center" style={{ padding: '40px 16px' }}>
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          아직 올린 게시물이 없어요
        </p>
      </div>
    );
  }

  // 가로 스크롤(프로필 미리보기) — 한 화면에 3개, 터치 스와이프 + 마우스 드래그
  if (horizontal) {
    return (
      <HorizontalPostsRow
        list={list}
        selectable={selectable}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
      />
    );
  }

  // 기본 — 3열 정사각형 그리드 (전체보기 화면)
  return (
    <div className="grid grid-cols-3" style={{ gap: 8 }}>
      {list.map((post) => (
        <PostRow
          key={post.id}
          post={post}
          selectable={selectable}
          selected={!!selectedIds && selectedIds.has(post.id)}
          onToggle={onToggleSelect}
        />
      ))}
    </div>
  );
}

/**
 * 가로 스크롤 리스트 — 모바일은 터치 스와이프, 데스크톱은 마우스 드래그로 좌우 이동.
 * 드래그로 이동한 경우엔 그 끝의 클릭(상세 진입)을 막아 의도치 않은 이동을 방지한다.
 */
function HorizontalPostsRow({ list, selectable, selectedIds, onToggleSelect }) {
  const scrollerRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const onMouseDown = (e) => {
    const el = scrollerRef.current;
    if (!el || e.button !== 0) return;
    drag.current = { active: true, startX: e.pageX, scrollLeft: el.scrollLeft, moved: false };
    el.style.cursor = 'grabbing';
  };
  const onMouseMove = (e) => {
    const el = scrollerRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.scrollLeft - dx;
  };
  const endDrag = () => {
    const el = scrollerRef.current;
    if (!drag.current.active) return;
    drag.current.active = false;
    if (el) el.style.cursor = 'grab';
  };
  // 드래그 직후의 클릭은 캡처 단계에서 삼켜 상세 진입을 막는다.
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div
      ref={scrollerRef}
      className="hide-scrollbar"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 2,
        touchAction: 'pan-x',
        scrollSnapType: 'x proximity',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {list.map((post) => (
        <div
          key={post.id}
          style={{
            flex: '0 0 auto',
            // 한 화면에 3개 노출 (gap 8 × 2 = 16px 빼고 3등분)
            width: 'calc((100% - 16px) / 3)',
            scrollSnapAlign: 'start',
          }}
        >
          <PostRow
            post={post}
            selectable={selectable}
            selected={!!selectedIds && selectedIds.has(post.id)}
            onToggle={onToggleSelect}
          />
        </div>
      ))}
    </div>
  );
}
