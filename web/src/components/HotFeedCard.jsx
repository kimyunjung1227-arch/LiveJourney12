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
    showLike = true,
}) => {
    if (!cardProps) return null;
    const {
        post,
        title,
        weather,
        hasWeather,
        hotReasonLabel,
        hotReasonIcon,
        captionForCard,
        avatars,
    } = cardProps;
    const likeCount = Number(post?.likes ?? post?.likeCount ?? 0) || 0;
    const safeHotReasonLabel = String(hotReasonLabel || '').trim() || '실시간';
    const safeHotReasonIcon = String(hotReasonIcon || '').trim() || 'bolt';
    const formatHotTag = (t) => {
        const raw = String(t || '').replace(/#/g, '').replace(/_/g, ' ').trim();
        if (!raw) return '';
        return raw.startsWith('#') ? raw : `#${raw}`;
    };
    const displayTags = (() => {
        if (Array.isArray(post?.reasonTags) && post.reasonTags.length > 0) {
            return post.reasonTags.slice(0, 3).map(formatHotTag).filter(Boolean);
        }
        if (!post?.reasonTags?.length && Array.isArray(post?.aiHotTags) && post.aiHotTags.length > 0) {
            return post.aiHotTags.slice(0, 2).map(formatHotTag).filter(Boolean);
        }
        return [];
    })();

    const tagChipStyle = {
        fontSize: 11,
        fontWeight: 800,
        color: '#0f172a',
        background: 'rgba(38, 198, 218, 0.14)',
        border: '1px solid rgba(38, 198, 218, 0.30)',
        padding: '2px 8px',
        borderRadius: 999,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    };

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
                        title="이 게시물이 핫플에 오른 이유"
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
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeHotReasonLabel}</span>
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
                            src={String(src).startsWith('data:') ? src : getDisplayImageUrl(src)}
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
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{title}</h4>
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#374151', lineHeight: 1.5, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', background: 'transparent', boxShadow: 'none' }}>{captionForCard}</p>
                {(hasWeather || displayTags.length > 0) && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            gap: 6,
                            marginTop: 6,
                            width: '100%',
                            minWidth: 0,
                        }}
                    >
                        {displayTags.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: '100%', minWidth: 0 }}>
                                {displayTags.map((tag) => (
                                    <span key={`${post?.id || 'post'}-tag-${String(tag)}`} style={tagChipStyle}>
                                        {String(tag)}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {hasWeather ? (
                            <div style={{ ...weatherPillStyle, alignSelf: 'flex-end', width: 'fit-content' }}>
                                {weather?.icon && <span>{weather.icon}</span>}
                                {weather?.temperature && <span>{weather.temperature}</span>}
                            </div>
                        ) : null}
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
