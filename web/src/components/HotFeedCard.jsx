import React from 'react';
import { getDisplayImageUrl } from '../api/upload';
import { getMapThumbnailUri } from '../utils/postMedia';

/** 핫플 사유 뱃지 — EXIF와 구분해 중립 톤으로 통일 */
const HOT_INDICATOR_BG = 'rgba(15, 23, 42, 0.88)';

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
                            background: HOT_INDICATOR_BG,
                            color: '#fff',
                            padding: '4px 9px',
                            borderRadius: 9999,
                            fontSize: 10,
                            fontWeight: 800,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            maxWidth: '100%',
                        }}
                    >
                        <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, fontVariationSettings: '"FILL" 1' }}>{hotReasonIcon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hotReasonLabel}</span>
                    </span>
                </div>
                {(() => {
                    const still = getMapThumbnailUri(post);
                    const src = still
                        || videoPosterUrl
                        || (Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || ''));
                    if (!src) return <div style={{ width: '100%', height: '100%', background: '#e5e7eb' }} />;
                    return (
                        <img
                            src={src.startsWith('data:') ? src : getDisplayImageUrl(src)}
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
