import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCamera, IconMapPin } from '@tabler/icons-react';
import { supabase } from '../../utils/supabaseClient';
import { getDisplayImageUrl } from '../../api/upload';
import { logger } from '../../utils/logger';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_TERTIARY = '#B8B8B8';
const SURFACE = '#F5F7FA';
const KEY = '#4DB8E8';

function postThumb(p) {
  const raw =
    (Array.isArray(p.images) && typeof p.images[0] === 'string' ? p.images[0] : '') ||
    p.photo_url ||
    '';
  return raw ? getDisplayImageUrl(raw) : '';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const now = new Date();
  if (y === now.getFullYear()) return `${m}월 ${day}일`;
  return `${y}.${m}.${day}`;
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
            'id, place_name, region, body, images, photo_url, captured_at, created_at',
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
 * 게시물 한 줄 — 사진 + 장소 + 설명(2줄) + 날짜.
 */
function PostRow({ post }) {
  const navigate = useNavigate();
  const thumb = postThumb(post);
  const place = post.place_name || post.region || '';
  const body = (post.body || '').trim();
  const date = formatDate(post.captured_at || post.created_at);

  return (
    <button
      type="button"
      onClick={() => navigate(`/post/${encodeURIComponent(post.id)}`)}
      className="flex items-stretch w-full text-left"
      style={{
        gap: 12,
        padding: '12px 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          flexShrink: 0,
          borderRadius: 12,
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
      </div>

      <div className="flex flex-col min-w-0" style={{ flex: 1, paddingTop: 2 }}>
        <div className="flex items-center" style={{ gap: 4, marginBottom: 4 }}>
          <IconMapPin size={13} color={KEY} stroke={2} style={{ flexShrink: 0 }} />
          <span
            className="min-w-0"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {place || '어딘가의 순간'}
          </span>
        </div>
        {body ? (
          <p
            className="m-0"
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: TEXT_SECONDARY,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {body}
          </p>
        ) : (
          <p className="m-0" style={{ fontSize: 12.5, color: TEXT_TERTIARY }}>
            설명이 없는 한 장
          </p>
        )}
        {date && (
          <span style={{ fontSize: 11, color: TEXT_TERTIARY, marginTop: 'auto', paddingTop: 4 }}>
            {date}
          </span>
        )}
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
 */
export default function UserPostsList({ posts }) {
  const list = Array.isArray(posts) ? posts : [];
  if (list.length === 0) {
    return (
      <div className="text-center" style={{ padding: '28px 16px' }}>
        <div
          className="flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: SURFACE,
            margin: '0 auto 12px',
          }}
        >
          <IconCamera size={22} color={TEXT_TERTIARY} stroke={1.6} />
        </div>
        <p className="m-0" style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
          아직 올린 게시물이 없어요
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {list.map((post, i) => (
        <div
          key={post.id}
          style={{ borderTop: i === 0 ? 'none' : '1px solid #F0F0F0' }}
        >
          <PostRow post={post} />
        </div>
      ))}
    </div>
  );
}
