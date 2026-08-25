import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconHeart,
  IconHeartFilled,
  IconMessageCircle,
  IconBookmark,
  IconBookmarkFilled,
  IconMapPin,
} from '@tabler/icons-react';
import {
  LJ,
  categoryLabel,
  formatExifTime,
  pickWeatherDisplay,
} from './tokens';
import MoreMenuDropdown from './MoreMenuDropdown';
import PhotoCarousel from './PhotoCarousel';
import ReportModal from './ReportModal';
import { postRegionLabel } from '../../utils/postRegionLabel';
import { useAuth } from '../../contexts/AuthContext';
import { deletePostSupabase } from '../../api/postsSupabase';
import { logger } from '../../utils/logger';
import WeatherIcon from '../WeatherIcon';

const BODY_PREVIEW_LINES = 4;

/**
 * 홈 피드 게시물 카드.
 * 구조: 위치명+지역(좌)·기온(우) → 사진(크게) → 아바타+이름+카테고리 → 제목 → 본문(4줄) → 태그 → 반응
 * - 위치명 옆에 지역(서울 성동구)을 붙이고 기온은 우측 끝
 *   → 어느 지역 소식인지 사진을 보기 전에 바로 인지되게
 * - 카테고리는 작성자 이름 우측 (분류는 보조 정보)
 * - 작성자 프로필은 사진 아래·제목 위로
 * - 사진과 반응 사이 구분선 없음
 * - 댓글 아이콘은 꼬리가 우측으로 가도록 좌우 반전
 */
export function PostCard({
  post,
  reactionState,
  photoHeight = 427,
  onToggleLike,
  onToggleSave,
  onDeleted,
  priority = false,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const author = post.author || {};
  const liked = !!reactionState?.liked;
  const saved = !!reactionState?.saved;
  const likeCount = reactionState?.likeCount ?? post.like_count ?? 0;
  const commentCount = post.comment_count ?? 0;
  // 상단: 장소명 + 지역(서울 성동구) + 기온 / 하단: 카테고리
  // 장소명 자체가 주소라 이미 지역을 품고 있으면(예: "서울 성동구 성수동…") 중복 표기하지 않는다.
  const regionRaw = postRegionLabel(post);
  const regionLabel =
    regionRaw && !String(post.place_name || '').replace(/\s+/g, '').includes(regionRaw.replace(/\s+/g, ''))
      ? regionRaw
      : '';
  const categoryText = post.category_raw || (post.category ? categoryLabel(post.category) : '');

  // 좋아요 애니메이션 트리거. "사용자가 눌렀을 때"만 재생한다
  // (서버 hydrate 로 liked 가 켜지는 건 애니메이션 대상이 아님)
  const [likeAnim, setLikeAnim] = useState(null); // { phase: 'like' | 'unlike', key: number }
  const handleLike = (e) => {
    e.stopPropagation();
    setLikeAnim((prev) => ({ phase: liked ? 'unlike' : 'like', key: (prev?.key || 0) + 1 }));
    onToggleLike?.(post.id);
  };

  // 공유 / 신고
  const [showReport, setShowReport] = useState(false);
  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    const title = post.place_name || 'Live Journey';
    const text = post.body ? `${title} — ${post.body.slice(0, 80)}` : title;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (_) {
      // 사용자가 취소했거나 share 실패 — 클립보드 fallback으로 넘어감
    }
    try {
      await navigator.clipboard.writeText(url);
      alert('링크를 복사했어요');
    } catch (_) {
      // 끝까지 실패하면 조용히 패스
    }
  };
  const handleReport = () => setShowReport(true);

  // 본인 게시물만 수정/삭제 노출 (판정은 UI 편의용이고, 실제 권한은 Supabase RLS가 강제)
  const authorId = author.id || post.author_id || post.user_id || null;
  const isAuthor = !!user?.id && !!authorId && String(user.id) === String(authorId);

  const [deleting, setDeleting] = useState(false);
  const handleEdit = () => navigate(`/post/${post.id}/edit`);
  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm('이 게시물을 삭제할까요? 되돌릴 수 없어요.')) return;
    setDeleting(true);
    try {
      const { success, error: delErr } = await deletePostSupabase(String(post.id));
      if (success) {
        onDeleted?.(post.id);
        return;
      }
      logger.warn('게시물 삭제 실패', delErr);
      window.alert('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  };

  const photosList =
    post.photos && post.photos.length > 0
      ? post.photos
      : [post.photo_url].filter(Boolean);
  // 영상+사진 통합 미디어 (영상 우선). 없으면 사진 목록으로 폴백.
  const mediaList =
    Array.isArray(post.media) && post.media.length > 0
      ? post.media
      : photosList.map((url) => ({ type: 'image', url }));
  const goPhoto = (startIndex = 0) =>
    navigate(`/photo/${post.id}`, { state: { photos: photosList, startIndex } });
  const goAuthor = (e) => {
    e.stopPropagation();
    navigate(`/user/${author.id || post.author_id}`);
  };
  const goPlace = (e) => {
    e.stopPropagation();
    const key = post.place_id || (post.place_name ? post.place_name.trim().toLowerCase() : '');
    if (!key) return;
    navigate(`/place/${encodeURIComponent(key)}`);
  };
  const goPostDetail = (e) => {
    e.stopPropagation();
    navigate(`/post/${post.id}`);
  };

  return (
    <article
      style={{
        background: LJ.bgCard,
        padding: '14px 18px 12px',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
      }}
    >
      {/* 위치명(좌·크게) + 지역·기온(우) — 사진 위 상단 헤더 */}
      {(post.place_name || regionLabel || post.weather || post.weatherSnapshot) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            margin: '0 0 10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              minWidth: 0,
              flex: '1 1 auto',
            }}
          >
            {post.place_name && (
              <button
                type="button"
                onClick={goPlace}
                aria-label={`${post.place_name} 장소 보기`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: LJ.fontStack,
                  fontSize: 17,
                  fontWeight: 600,
                  color: LJ.textPrimary,
                  letterSpacing: -0.3,
                  lineHeight: 1.3,
                  textAlign: 'left',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {post.place_name}
              </button>
            )}
          </div>
          {/* 지역(서울 성동구) + 기온 — 우측에 붙여 한 덩어리로 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            {regionLabel && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: LJ.textSecondary,
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                }}
              >
                <IconMapPin size={14} stroke={2} color={LJ.key} style={{ flexShrink: 0 }} />
                {regionLabel}
              </span>
            )}
            <WeatherChip weather={post.weather || post.weatherSnapshot} />
          </div>
        </div>
      )}

      {/* 사진 (세로 크게 + 가로 약간 좁혀 한 구역 안에 담긴 느낌) */}
      <div style={{ position: 'relative', margin: '0 8px' }}>
        <PhotoCarousel
          media={mediaList}
          photos={photosList}
          height={photoHeight}
          alt={post.place_name}
          priority={priority}
          radius={6}
          onPhotoClick={(i) => {
            // i는 통합 미디어 인덱스 → 사진 뷰어는 사진만 받으므로 사진 인덱스로 환산
            const url = mediaList[i]?.url;
            const photoIdx = Math.max(0, photosList.indexOf(url));
            goPhoto(photoIdx);
          }}
        />
        {/* 좌상단 EXIF 뱃지 (날씨는 위치명 옆에서만 노출) */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            pointerEvents: 'none',
          }}
        >
          <ExifBadge takenAt={post.exif_taken_at} />
        </div>
      </div>

      {/* 작성자 행: 아바타 | 이름(N) — 제목 위로 이동 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 0' }}>
        <Avatar nickname={author.nickname} avatarUrl={author.avatar_url} size={28} onClick={goAuthor} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            color: LJ.textSecondary,
          }}
        >
          <button
            type="button"
            onClick={goAuthor}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: LJ.fontStack,
              fontSize: 13,
              fontWeight: 600,
              color: LJ.textPrimary,
            }}
          >
            {author.nickname || '작성자'}
          </button>
          {typeof author.post_count === 'number' && author.post_count > 0 && (
            <span style={{ fontSize: 12, color: LJ.textTertiary }}>({author.post_count})</span>
          )}
        </div>
        {/* 카테고리(노을·야경 등) — 작성자 행 우측 끝 */}
        {categoryText && (
          <span
            style={{
              flexShrink: 0,
              marginLeft: 'auto',
              fontSize: 11.5,
              fontWeight: 600,
              color: LJ.textSecondary,
              background: LJ.bgSurface,
              padding: '4px 9px',
              borderRadius: 999,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {categoryText}
          </span>
        )}
      </div>

      {/* 제목 (작성자가 입력) — 프로필 아래 헤드라인 */}
      {post.title && (
        <button
          type="button"
          onClick={goPostDetail}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: LJ.fontStack,
            fontSize: 16.5,
            fontWeight: 700,
            color: LJ.textPrimary,
            letterSpacing: -0.3,
            lineHeight: 1.35,
            margin: '8px 0 4px',
            wordBreak: 'break-word',
          }}
        >
          {post.title}
        </button>
      )}

      {/* 본문 (4줄 클램프) */}
      {post.body && <ClampedBody text={post.body} />}

      {/* 선택한 실시간 태그 */}
      {Array.isArray(post.tags) && post.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {post.tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: LJ.keyTextDark,
                background: LJ.keyBgLight,
                padding: '4px 9px',
                borderRadius: 999,
                lineHeight: 1,
              }}
            >
              {typeof t === 'string' ? t.replace(/^#+/, '') : t}
            </span>
          ))}
        </div>
      )}

      {/* 반응 줄 — 좋아요/댓글은 좌측, 저장+점세개는 우측 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ReactionButton
            active={liked}
            icon={
              <LikeHeart
                liked={liked}
                anim={likeAnim}
                size={19}
                colorOff={LJ.textSecondary}
                colorOn={LJ.key}
              />
            }
            count={likeCount}
            onClick={handleLike}
            ariaLabel={liked ? '좋아요 취소' : '좋아요'}
          />
          <ReactionButton
            active={false}
            iconOff={<IconMessageCircle size={19} stroke={2} />}
            iconOn={<IconMessageCircle size={19} stroke={2} />}
            count={commentCount}
            onClick={goPostDetail}
            ariaLabel="댓글"
          />
          <ReactionButton
            active={saved}
            iconOff={<IconBookmark size={19} stroke={2} />}
            iconOn={<IconBookmarkFilled size={19} />}
            count={null}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave?.(post.id);
            }}
            ariaLabel="저장"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <MoreMenuDropdown
            postId={post.id}
            isAuthor={isAuthor}
            onShare={handleShare}
            onReport={handleReport}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {showReport && (
        <ReportModal postId={post.id} onClose={() => setShowReport(false)} />
      )}
    </article>
  );
}

function ClampedBody({ text }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const ref = useRef(null);

  // overflow 감지: 초기 렌더 + 폭 변화(폰트 로드/리사이즈) 모두 대응
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (expanded) return; // 펼친 상태에선 의미 없음
      setIsOverflow(el.scrollHeight - 1 > el.clientHeight);
    };
    check();
    // 폰트 로드 후 한 번 더
    const t = setTimeout(check, 50);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(check);
      ro.observe(el);
    }
    return () => {
      clearTimeout(t);
      ro?.disconnect();
    };
  }, [text, expanded]);

  return (
    <div style={{ marginTop: 10 }}>
      <p
        ref={ref}
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: LJ.textPrimary,
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : BODY_PREVIEW_LINES,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </p>
      {isOverflow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-label={expanded ? '본문 접기' : '본문 더보기'}
          style={{
            marginTop: 4,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: LJ.textSecondary,
            fontFamily: LJ.fontStack,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          {expanded ? '접기' : '…  더보기'}
        </button>
      )}
    </div>
  );
}

function Avatar({ nickname, avatarUrl, size = 28, onClick }) {
  const initial = (nickname || '?').slice(0, 1);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${nickname || '작성자'} 프로필`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        background: LJ.key,
        border: 'none',
        cursor: 'pointer',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.42,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        initial
      )}
    </button>
  );
}

/**
 * 좋아요 하트.
 * - 누르면: 하트가 위에서 떨어져 내려오고(.lj-heart-drop) 색이 위→아래로 차오른다(.lj-heart-pour)
 * - 취소하면: 색이 아래로 빠지며 사라지고(.lj-heart-drain) 하트가 살짝 눌린다(.lj-heart-sink)
 * 외곽선 하트를 항상 깔고 채워진 하트를 위에 겹쳐, clip-path 로 "채워지는" 느낌을 만든다.
 * `anim` 은 사용자가 버튼을 눌렀을 때만 새 객체로 바뀐다 → 목록 재조회/hydrate 로는 재생되지 않는다.
 */
function LikeHeart({ liked, anim, size = 19, colorOff, colorOn }) {
  const [phase, setPhase] = useState('idle'); // 'like' | 'unlike' | 'idle'
  const lastKeyRef = useRef(0);

  useEffect(() => {
    if (!anim || anim.key === lastKeyRef.current) return;
    lastKeyRef.current = anim.key;
    setPhase(anim.phase);
    const t = setTimeout(() => setPhase('idle'), anim.phase === 'like' ? 520 : 240);
    return () => clearTimeout(t);
  }, [anim]);

  // 취소 애니메이션이 끝날 때까지 채워진 하트를 남겨 둔다
  const showFill = liked || phase === 'unlike';
  const wrapperAnim =
    phase === 'like' ? ' lj-heart-drop' : phase === 'unlike' ? ' lj-heart-sink' : '';
  const fillAnim =
    phase === 'like' ? ' lj-heart-pour' : phase === 'unlike' ? ' lj-heart-drain' : '';

  return (
    <span className={`lj-heart${wrapperAnim}`} style={{ width: size, height: size }}>
      <span className="lj-heart-outline" style={{ color: colorOff }}>
        <IconHeart size={size} stroke={2} />
      </span>
      {showFill && (
        <span className={`lj-heart-fill${fillAnim}`} style={{ color: colorOn }}>
          <IconHeartFilled size={size} />
        </span>
      )}
    </span>
  );
}

function ReactionButton({ active, icon, iconOff, iconOn, count, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'transparent',
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        color: active ? LJ.key : LJ.textSecondary,
        fontFamily: LJ.fontStack,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
      }}
    >
      {icon ?? (active ? iconOn : iconOff)}
      {count != null && <span style={{ minWidth: 12 }}>{count}</span>}
    </button>
  );
}

// EXIF 촬영 시각 배지: "5분 전" (신선도 판정 아이콘·점수 표기는 노출하지 않음)
function ExifBadge({ takenAt }) {
  const relative = formatExifTime(takenAt);
  if (!relative) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '7px 12px',
        background: 'rgba(0,0,0,0.78)',
        borderRadius: 999,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {relative}
      </span>
    </div>
  );
}

// 날씨(아이콘+기온+상태) 한 줄. 예) "☀️ 29℃ 맑음"
function WeatherChip({ weather }) {
  const display = pickWeatherDisplay(weather);
  if (!display) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        fontFamily: LJ.fontStack,
        fontSize: 13,
        color: LJ.textSecondary,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {display.icon && (
        <WeatherIcon icon={display.icon} condition={display.condition} size={15} />
      )}
      {display.temperature && (
        <span
          style={{
            color: LJ.textPrimary,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {display.temperature}
        </span>
      )}
      {display.condition && (
        <span style={{ color: LJ.textSecondary, fontWeight: 500 }}>{display.condition}</span>
      )}
    </span>
  );
}

export default PostCard;
