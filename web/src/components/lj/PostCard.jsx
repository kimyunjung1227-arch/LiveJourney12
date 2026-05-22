import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconShieldCheck,
  IconMapPin,
  IconHeart,
  IconHeartFilled,
  IconMessageCircle,
  IconBookmarks,
  IconBookmarksFilled,
} from '@tabler/icons-react';
import {
  LJ,
  categoryLabel,
  formatExifTime,
  formatExifStamp,
  formatRemaining,
  pickWeatherDisplay,
} from './tokens';
import MoreMenuDropdown from './MoreMenuDropdown';
import PhotoCarousel from './PhotoCarousel';
import ReportModal from './ReportModal';

const BODY_PREVIEW_LINES = 4;

/**
 * 홈 피드 게시물 카드.
 * 구조: 사진(크게) → 아바타+이름(글수)+남은시간 → 위치명(타이틀) → 본문(4줄) → 반응
 * - 사진과 반응 사이 구분선 없음
 * - 위치명은 헤드라인처럼 굵게/크게
 * - 댓글 아이콘은 꼬리가 우측으로 가도록 좌우 반전
 */
export function PostCard({
  post,
  reactionState,
  photoHeight = 340,
  onToggleLike,
  onToggleSave,
  priority = false,
}) {
  const navigate = useNavigate();
  const author = post.author || {};
  const liked = !!reactionState?.liked;
  const saved = !!reactionState?.saved;
  const likeCount = reactionState?.likeCount ?? post.like_count ?? 0;
  const saveCount = reactionState?.saveCount ?? post.save_count ?? 0;
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
  const goPhoto = (startIndex = 0) =>
    navigate(`/photo/${post.id}`, { state: { photos: photosList, startIndex } });
  const goAuthor = (e) => {
    e.stopPropagation();
    navigate(`/user/${author.id || post.author_id}`);
  };
  const goPlace = (e) => {
    e.stopPropagation();
    if (post.place_id) navigate(`/place/${post.place_id}`);
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
      {/* 사진 (더 크게 + 멀티 캐러셀) */}
      <div style={{ position: 'relative' }}>
        <PhotoCarousel
          photos={photosList}
          height={photoHeight}
          alt={post.place_name}
          priority={priority}
          onPhotoClick={(i) => goPhoto(i)}
        />
        {/* 좌상단 EXIF + 날씨 뱃지 (스택) */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          <ExifBadge takenAt={post.exif_taken_at} />
          <WeatherChip weather={post.weather || post.weatherSnapshot} />
        </div>
        {/* 우상단 카테고리 뱃지 */}
        {(post.category_raw || post.category) && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              padding: '4px 9px',
              background: '#fff',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: LJ.textPrimary,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              pointerEvents: 'none',
            }}
          >
            {post.category_raw || categoryLabel(post.category)}
          </div>
        )}
      </div>

      {/* EXIF 촬영시각 명시 줄 — 사진 직하단에서 한 번 더 또렷이 */}
      <CardExifLine takenAt={post.exif_taken_at} />

      {/* 작성자 행: 아바타 | 이름(N) · 남은시간 | 지금 현장 — 카드 상단으로 이동 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 8px' }}>
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
          <span style={{ color: LJ.textTertiary }}>·</span>
          <span>{formatRemaining(post.expires_at)}</span>
        </div>
        {post.is_on_site && <OnSiteBadge />}
      </div>

      {/* 위치명 (작성자 아래로 이동) */}
      {post.place_name && (
        <button
          type="button"
          onClick={goPlace}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: '0 0 6px',
            cursor: post.place_id ? 'pointer' : 'default',
            fontFamily: LJ.fontStack,
            fontSize: 17,
            fontWeight: 700,
            color: LJ.textPrimary,
            letterSpacing: -0.3,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            textAlign: 'left',
          }}
        >
          <IconMapPin size={16} stroke={2} color={LJ.key} />
          {post.place_name}
        </button>
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
                <IconHeart size={19} stroke={1.8} />
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
            iconOff={<IconMessageCircle size={19} stroke={1.8} />}
            iconOn={<IconMessageCircle size={19} stroke={1.8} />}
            count={commentCount}
            onClick={goPostDetail}
            ariaLabel="댓글"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ReactionButton
            active={saved}
            iconOff={<IconBookmarks size={19} stroke={1.8} />}
            iconOn={<IconBookmarksFilled size={19} />}
            count={saveCount}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave?.(post.id);
            }}
            ariaLabel="저장"
          />
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
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
      <span style={{ minWidth: 12 }}>{count}</span>
    </button>
  );
}

function ExifBadge({ takenAt }) {
  const stamp = formatExifStamp(takenAt);
  const relative = formatExifTime(takenAt);
  if (!stamp && !relative) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 11px',
        background: 'rgba(0,0,0,0.78)',
        borderRadius: 8,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      <IconShieldCheck size={15} stroke={2} color={LJ.key} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          EXIF 촬영
        </span>
        {stamp && (
          <span
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.2,
              fontVariantNumeric: 'tabular-nums',
              marginTop: 1,
            }}
          >
            {stamp}
          </span>
        )}
        {relative && (
          <span
            style={{
              color: LJ.key,
              fontSize: 10,
              fontWeight: 600,
              marginTop: 1,
            }}
          >
            {relative}
          </span>
        )}
      </div>
    </div>
  );
}

function CardExifLine({ takenAt }) {
  const stamp = formatExifStamp(takenAt);
  const relative = formatExifTime(takenAt);
  if (!stamp && !relative) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        padding: '5px 9px',
        background: LJ.keyBgLight,
        borderRadius: 6,
        fontSize: 12,
        color: LJ.keyTextDark,
        fontFamily: LJ.fontStack,
      }}
    >
      <IconShieldCheck size={13} stroke={2} color={LJ.keyTextDark} />
      <span style={{ fontWeight: 700, letterSpacing: 0.2 }}>촬영</span>
      {stamp && (
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: LJ.textPrimary,
          }}
        >
          {stamp}
        </span>
      )}
      {relative && (
        <span style={{ color: LJ.textSecondary, fontWeight: 500 }}>· {relative}</span>
      )}
    </div>
  );
}

function WeatherChip({ weather }) {
  const display = pickWeatherDisplay(weather);
  if (!display) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 6,
        backdropFilter: 'blur(8px)',
      }}
    >
      {display.icon && <span style={{ fontSize: 12, lineHeight: 1 }}>{display.icon}</span>}
      {display.temperature && (
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
          {display.temperature}
        </span>
      )}
      {display.condition && (
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 500 }}>
          {display.condition}
        </span>
      )}
    </div>
  );
}

function OnSiteBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: LJ.keyBgLight,
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: LJ.keyTextDark,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          background: LJ.key,
          borderRadius: '50%',
          display: 'inline-block',
        }}
      />
      지금 현장
    </span>
  );
}

export default PostCard;
