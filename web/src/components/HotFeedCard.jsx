import React from 'react';
import { getDisplayImageUrl } from '../api/upload';
import { getMapThumbnailUri, toMediaStr } from '../utils/postMedia';

/** 핫플 사유 뱃지 — EXIF와 구분해 중립 톤으로 통일 */
const HOT_INDICATOR_BG = 'rgba(15, 23, 42, 0.88)';
const LIVE_PRIMARY = '#26C6DA';

/**
 * 메인 실시간 핫플 / 더보기 화면 — 동일 카드 UI (마크업·스타일 통일)
 */
const HotFeedCard = ({
    cardProps,
    socialText,
    liked,
    onCardClick,
    onLikeClick,
    videoPosterUrl = null,
    showLike = true,
}) => {
    if (!cardProps) return null;
    const {
        post,
        title,
        weather,
        hasWeather,
        regionShort,
        hotReasonLabel,
        hotReasonIcon,
        cityDongLine,
        captionForCard,
        photoCategoryLabels,
        avatars,
    } = cardProps;
    const likeCount = Number(post?.likes ?? post?.likeCount ?? 0) || 0;
    const rank = Number(post?._rank);
    const hasRank = Number.isFinite(rank) && rank > 0;
    const safeHotReasonLabel = String(hotReasonLabel || '').trim() || '실시간';
    const safeHotReasonIcon = String(hotReasonIcon || '').trim() || 'bolt';
    const viewingCount = Number(cardProps?.viewingCount ?? 0) || 0;
    const viewingLabel = viewingCount >= 1000 ? `${Math.floor(viewingCount / 100) * 100}+` : `${Math.max(0, viewingCount)}`;
    const isTopRank = rank === 1;

    return (
        <div
            className="hot-feed-card-enter"
            onClick={onCardClick}
            style={{
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                overflow: 'visible',
            }}
            role="presentation"
        >
            <style>
                {`@keyframes ljLiveBlink { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }`}
            </style>
            <div
                className="main-hot-feed-media"
                style={{
                    width: '100%',
                    aspectRatio: '4/3',
                    maxHeight: 'min(54vw, 36dvh, 228px)',
                    position: 'relative',
                    background: '#e5e7eb',
                    overflow: 'hidden',
                    borderRadius: 14,
                    boxShadow: '0 2px 14px rgba(15, 23, 42, 0.07)',
                    outline: isTopRank ? `1.5px solid rgba(38, 198, 218, 0.55)` : undefined,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: 10,
                        left: 12,
                        zIndex: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        maxWidth: 'calc(100% - 100px)',
                    }}
                >
                    {hasRank ? (
                        <div
                            aria-label={`랭킹 ${rank}위`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                borderRadius: 10,
                                background: 'transparent',
                                color: LIVE_PRIMARY,
                                fontSize: isTopRank ? 34 : 30,
                                fontWeight: 950,
                                letterSpacing: -1.2,
                                lineHeight: 1,
                                textShadow: '0 6px 18px rgba(0,0,0,0.30)',
                            }}
                        >
                            {rank}
                        </div>
                    ) : null}
                </div>

                {/* Live badge (visual separation from rank) */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 10,
                        right: 10,
                        zIndex: 11,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '7px 10px',
                        borderRadius: 9999,
                        background: 'rgba(15, 23, 42, 0.55)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 20px rgba(15,23,42,0.22)',
                        maxWidth: 'calc(100% - 20px)',
                    }}
                    aria-label="실시간"
                >
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 9999,
                            background: LIVE_PRIMARY,
                            boxShadow: '0 0 0 3px rgba(38,198,218,0.18)',
                            animation: 'ljLiveBlink 1.1s ease-in-out infinite',
                            flexShrink: 0,
                        }}
                    />
                    <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: '"FILL" 1', color: '#ffffff' }}>
                        bolt
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>LIVE</span>
                </div>

                {/* Why-rank proof badge (front of card) */}
                <div
                    title="실시간 반응"
                    style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 11,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 10px',
                        borderRadius: 9999,
                        background: 'rgba(15, 23, 42, 0.72)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        boxShadow: '0 10px 22px rgba(0,0,0,0.20)',
                    }}
                >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>🔥</span>
                    <span style={{ fontSize: 11, fontWeight: 950, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>
                        실시간 조회수 {viewingLabel}
                    </span>
                </div>

                {/* Hot reason tag (clear label, separated from rank) */}
                <div
                    style={{
                        position: 'absolute',
                        top: 56,
                        left: 12,
                        zIndex: 11,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 10px',
                        borderRadius: 9999,
                        background: 'rgba(15, 23, 42, 0.88)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        boxShadow: '0 10px 22px rgba(0,0,0,0.18)',
                        maxWidth: 'calc(100% - 24px)',
                    }}
                    aria-label="핫플 사유 태그"
                >
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18, fontVariationSettings: '"FILL" 1' }}>
                        {safeHotReasonIcon}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: -0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {safeHotReasonLabel}
                    </span>
                </div>
                {showLike !== false && typeof onLikeClick === 'function' && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onLikeClick(e, post);
                        }}
                        aria-label={liked ? '좋아요 취소' : '좋아요'}
                        aria-pressed={!!liked}
                        style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 9999,
                            border: '1px solid rgba(255,255,255,0.55)',
                            background: 'rgba(15, 23, 42, 0.45)',
                            color: '#fff',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                            cursor: 'pointer',
                        }}
                    >
                        <span
                            className="material-symbols-outlined"
                            style={{
                                fontSize: 18,
                                fontVariationSettings: liked ? '"FILL" 1' : '"FILL" 0',
                                color: liked ? '#fb7185' : '#ffffff',
                            }}
                        >
                            favorite
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1 }}>
                            {likeCount}
                        </span>
                    </button>
                )}
                {(() => {
                    const still = getMapThumbnailUri(post);
                    const raw =
                        still ||
                        videoPosterUrl ||
                        (Array.isArray(post.images) && post.images.length > 0
                            ? post.images[0]
                            : post.image || post.thumbnail || '');
                    const src = toMediaStr(raw);
                    if (!src) return <div style={{ width: '100%', height: '100%', background: '#e5e7eb' }} />;
                    return (
                        <img
                            src={String(src).startsWith('data:') ? src : getDisplayImageUrl(src)}
                            alt={title}
                            decoding="async"
                            fetchPriority="high"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    );
                })()}
            </div>
            <div style={{ padding: '8px 2px 2px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{title}</h4>
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#374151', lineHeight: 1.5, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', background: 'transparent', boxShadow: 'none' }}>{captionForCard}</p>
                {(photoCategoryLabels?.length > 0 || cityDongLine || regionShort || hasWeather) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1, minWidth: 0, alignItems: 'center' }}>
                            {cityDongLine ? (
                                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {cityDongLine}
                                </span>
                            ) : (photoCategoryLabels?.length > 0
                                ? photoCategoryLabels.map((label, i) => (
                                    <span
                                        key={`${post.id}-cat-${i}`}
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: '#4b5563',
                                            background: '#f3f4f6',
                                            padding: '2px 6px',
                                            borderRadius: 6,
                                        }}
                                    >
                                        {label}
                                    </span>
                                ))
                                : null)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {regionShort ? (
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        background: 'rgba(15,23,42,0.08)',
                                        padding: '3px 8px',
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: '#374151',
                                        maxWidth: 132,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0 }}>location_on</span>
                                    <span>{regionShort}</span>
                                </div>
                            ) : null}
                            {hasWeather ? (
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        background: 'rgba(15,23,42,0.08)',
                                        padding: '3px 8px',
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: '#374151',
                                    }}
                                >
                                    {weather.icon && <span style={{ fontSize: 12 }}>{weather.icon}</span>}
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                                        {weather.temperature}
                                        {weather.condition && weather.condition !== '-' ? ` ${weather.condition}` : ''}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 2 }}>
                            {avatars.slice(0, 3).map((url, ai) => (
                                <img
                                    key={`${post.id}-av-${ai}`}
                                    src={url}
                                    alt=""
                                    style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: '50%',
                                        border: '2px solid #fff',
                                        marginLeft: ai === 0 ? 0 : -9,
                                        objectFit: 'cover',
                                        flexShrink: 0,
                                        background: '#e2e8f0',
                                    }}
                                />
                            ))}
                            {avatars.length === 0 && (
                                <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }} aria-hidden>👤</span>
                            )}
                        </div>
                        <span
                            style={{ fontSize: 11, color: '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                        >
                            {socialText}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HotFeedCard;
