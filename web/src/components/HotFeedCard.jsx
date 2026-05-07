import React from 'react';
import { getDisplayImageUrl } from '../api/upload';
import { getMapThumbnailUri, toMediaStr } from '../utils/postMedia';

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
    placeDescription = '',
    showLike = true,
    imageUrlOpts = null,
}) => {
    if (!cardProps) return null;
    const {
        post,
        title,
        weather,
        hasWeather,
        hotReasonLabel,
        hotBadgeTitle,
        hotBadgeReason,
        hotReasonIcon,
        captionForCard,
        avatars,
    } = cardProps;
    const likeCount = Number(post?.likes ?? post?.likeCount ?? 0) || 0;
    const safeHotReasonLabel = String(hotReasonLabel || '').trim() || '실시간';
    const badgeTitle = String(hotBadgeTitle || '').trim() || '실시간 핫플';
    const badgeReason = String(hotBadgeReason || '').trim();
    const safeHotReasonIcon = String(hotReasonIcon || '').trim() || 'bolt';

    const weatherPillStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        background: 'rgba(15,23,42,0.08)',
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color: '#374151',
        whiteSpace: 'nowrap',
    };

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
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        maxWidth: 'calc(100% - 100px)',
                    }}
                >
                    <span
                        title="왜 지금 핫플인지"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'rgba(15, 23, 42, 0.92)',
                            color: '#fff',
                            padding: '6px 11px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 850,
                            letterSpacing: -0.2,
                            boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
                            maxWidth: '100%',
                            border: '1px solid rgba(255,255,255,0.22)',
                        }}
                    >
                        <span
                            className="material-symbols-outlined shrink-0"
                            style={{ fontSize: 16, fontVariationSettings: '"FILL" 1' }}
                        >
                            {safeHotReasonIcon}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.05 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {badgeTitle}
                            </span>
                            {badgeReason ? (
                                <span
                                    style={{
                                        marginTop: 2,
                                        fontSize: 10,
                                        fontWeight: 750,
                                        color: 'rgba(255,255,255,0.86)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: 220,
                                    }}
                                >
                                    {badgeReason}
                                </span>
                            ) : (
                                <span style={{ display: 'none' }}>{safeHotReasonLabel}</span>
                            )}
                        </span>
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
                    const thumbStr =
                        typeof post.thumbnail === 'string'
                            ? post.thumbnail
                            : Array.isArray(post.thumbnail)
                              ? ''
                              : post.thumbnail
                                ? toMediaStr(post.thumbnail)
                                : '';
                    const raw =
                        still ||
                        videoPosterUrl ||
                        (Array.isArray(post.images) && post.images.length > 0
                            ? post.images[0]
                            : post.image || thumbStr || '');
                    const src = toMediaStr(raw);
                    if (!src) return <div style={{ width: '100%', height: '100%', background: '#e5e7eb' }} />;
                    return (
                        <img
                            src={String(src).startsWith('data:') ? src : getDisplayImageUrl(src, imageUrlOpts || undefined)}
                            alt={title}
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    );
                })()}
            </div>
            <div style={{ padding: '8px 2px 2px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 850, color: '#111827', lineHeight: 1.3, letterSpacing: '-0.02em', minWidth: 0, flex: 1 }}>
                        {title}
                    </h4>
                    {hasWeather ? (
                        <div style={{ ...weatherPillStyle, alignSelf: 'flex-start' }}>
                            {weather?.icon && <span>{weather.icon}</span>}
                            {weather?.temperature && <span>{weather.temperature}</span>}
                        </div>
                    ) : null}
                </div>
                <p
                    style={{
                        margin: '8px 0 0 0',
                        fontSize: '12px',
                        color: '#111827',
                        lineHeight: 1.55,
                        fontWeight: 600,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        background: 'transparent',
                        boxShadow: 'none',
                    }}
                >
                    {String(placeDescription || '').trim() || captionForCard}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 2 }}>
                            {avatars.slice(0, 3).map((url, ai) => (
                                <img
                                    key={`${post.id}-av-${ai}`}
                                    src={url}
                                    alt=""
                                    loading="eager"
                                    decoding="async"
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
