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
import ExifFreshIcon from './ExifFreshIcon';

const BODY_PREVIEW_LINES = 4;

/**
 * 홈 피드 게시물 카드.
 * 구조: 사진(크게) → 아바타+이름(글수) → 위치명(타이틀) → 본문(4줄) → 반응
 * - 사진과 반응 사이 구분선 없음
 * - 위치명은 헤드라인처럼 굵게/크게
 * - 댓글 아이콘은 꼬리가 우측으로 가도록 좌우 반전
 */
export function PostCard({
  post,
  reactionState,
  photoHeight = 427,
  onToggleLike,
  onToggleSave,
  priority = false,
}) {
  const navigate = useNavigate();
  const author = post.author || {};
  const liked = !!reactionState?.liked;
  const saved = !!reactionState?.saved;
  const likeCount = reactionState?.likeCount ?? post.like_count ?? 0;
  const commentCount = post.comment_count ?? 0;

  // 좋아요 클릭마다 펄스 재생 (key 증분으로 애니메이션 재시작)
  const [likePulseKey, setLikePulseKey] = useState(0);
  const handleLike = (e) => {
    e.stopPropagation();
    setLikePulseKey((k) => k + 1);
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
      {/* 작성자 행: 아바타 | 이름(N) | 카테고리 — 사진 위로 이동 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px' }}>
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
        {(post.category_raw || post.category) && (
          <span
            style={{
              padding: '3px 9px',
              background: LJ.bgSurface,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: LJ.textSecondary,
              flexShrink: 0,
            }}
          >
            {post.category_raw || categoryLabel(post.category)}
          </span>
        )}
      </div>

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

      {/* 제목 (작성자가 입력) — 위치명 위 헤드라인 */}
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
            margin: '12px 0 4px',
            wordBreak: 'break-word',
          }}
        >
          {post.title}
        </button>
      )}

      {/* 위치명 (좌) + 기온 (우) — 제목이 있으면 위치는 작은 보조 줄로 */}
      {(post.place_name || post.weather || post.weatherSnapshot) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            margin: post.title ? '0 0 6px' : '12px 0 6px',
          }}
        >
          {post.place_name ? (
            <button
              type="button"
              onClick={goPostDetail}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: LJ.fontStack,
                fontSize: post.title ? 13 : 17,
                fontWeight: post.title ? 600 : 700,
                color: post.title ? LJ.textSecondary : LJ.textPrimary,
                letterSpacing: -0.3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                textAlign: 'left',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              {post.title && (
                <IconMapPin size={13} stroke={2} color={LJ.textTertiary} style={{ flexShrink: 0 }} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {post.place_name}
              </span>
            </button>
          ) : (
            <span />
          )}
          <WeatherInlineChip weather={post.weather || post.weatherSnapshot} />
        </div>
      )}

      {/* 본문 (4줄 클램프) */}
      {post.body && <ClampedBody text={post.body} />}

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
            iconOff={
              <span key={`off-${likePulseKey}`} className={likePulseKey > 0 ? 'lj-heart-pulse' : ''}>
                <IconHeart size={19} stroke={2} />
              </span>
            }
            iconOn={
              <span key={`on-${likePulseKey}`} className={likePulseKey > 0 ? 'lj-heart-pulse' : ''}>
                <IconHeartFilled size={19} />
              </span>
            }
            count={likeCount}
            onClick={handleLike}
            ariaLabel="좋아요"
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
          <MoreMenuDropdown postId={post.id} onShare={handleShare} onReport={handleReport} />
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

function ReactionButton({ active, iconOff, iconOn, count, onClick, ariaLabel }) {
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
      {active ? iconOn : iconOff}
      {count != null && <span style={{ minWidth: 12 }}>{count}</span>}
    </button>
  );
}

function ExifBadge({ takenAt }) {
  const relative = formatExifTime(takenAt);
  if (!relative) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        background: 'rgba(0,0,0,0.78)',
        borderRadius: 999,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}
    >
      <ExifFreshIcon iso={takenAt} size={15} stroke={2} />
      <span
        style={{
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.2,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {relative}
      </span>
    </div>
  );
}

function WeatherInlineChip({ weather }) {
  const display = pickWeatherDisplay(weather);
  if (!display) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: 0,
        fontFamily: LJ.fontStack,
        fontSize: 13,
        color: LJ.textSecondary,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {display.icon && <span style={{ fontSize: 14, lineHeight: 1 }}>{display.icon}</span>}
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
