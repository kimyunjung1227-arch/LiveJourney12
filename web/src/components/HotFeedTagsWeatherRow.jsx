import React from 'react';

const TAG_CHIP_STYLE = {
    fontSize: 11,
    fontWeight: 800,
    color: '#0f172a',
    background: 'rgba(38, 198, 218, 0.14)',
    border: '1px solid rgba(38, 198, 218, 0.30)',
    padding: '3px 8px',
    borderRadius: 999,
    lineHeight: 1.2,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const WEATHER_CHIP_STYLE = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 750,
    letterSpacing: -0.2,
    color: '#0c4a6e',
    background: 'linear-gradient(180deg, rgba(224, 242, 254, 0.92) 0%, rgba(186, 230, 253, 0.45) 100%)',
    border: '1px solid rgba(14, 165, 233, 0.42)',
    padding: '4px 10px',
    borderRadius: 10,
    lineHeight: 1.2,
    maxWidth: '100%',
    boxShadow: '0 1px 4px rgba(14, 116, 144, 0.12)',
    whiteSpace: 'nowrap',
};

export function buildHotFeedTagLabels(post, max = 3) {
    if (!post) return [];
    const hotTagsRaw =
        (Array.isArray(post.reasonTags) && post.reasonTags.length > 0
            ? post.reasonTags
            : (Array.isArray(post.aiHotTags) && post.aiHotTags.length > 0
                ? post.aiHotTags
                : (Array.isArray(post.tags) ? post.tags : []))) || [];
    return hotTagsRaw
        .map((t) => String(typeof t === 'string' ? t : (t?.name || t?.label || '')))
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, max)
        .map((t) => {
            const withHash = t.startsWith('#') ? t : `#${t}`;
            return withHash.replace(/_+/g, ' ');
        });
}

/**
 * 메인 실시간 핫플(HotFeedCard)과 동일한 태그·기온 칩 한 줄
 */
export default function HotFeedTagsWeatherRow({
    post,
    weather = null,
    hasWeather = false,
    marginTop = 8,
    idPrefix = '',
}) {
    const hotTags = buildHotFeedTagLabels(post);
    if (!hotTags.length && !hasWeather) return null;

    const prefix = idPrefix || post?.id || 'row';

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop, alignItems: 'center' }}>
            {hotTags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}>
                    {hotTags.map((t) => (
                        <span key={`${prefix}-hot-tag-${t}`} style={TAG_CHIP_STYLE} title={t}>
                            {t}
                        </span>
                    ))}
                </div>
            ) : null}
            {hasWeather && weather ? (
                <span
                    key={`${prefix}-weather`}
                    style={{
                        ...WEATHER_CHIP_STYLE,
                        flexShrink: 0,
                    }}
                    title={
                        weather.condition && weather.condition !== '-'
                            ? `${weather.temperature} ${weather.condition}`
                            : String(weather.temperature || '')
                    }
                >
                    {weather.icon ? (
                        <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1 }} aria-hidden>{weather.icon}</span>
                    ) : (
                        <span
                            className="material-symbols-outlined shrink-0"
                            style={{ fontSize: 15, fontVariationSettings: '"FILL" 0', color: '#0369a1' }}
                            aria-hidden
                        >
                            thermostat
                        </span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {weather.temperature}
                        {weather.condition && weather.condition !== '-' ? ` · ${weather.condition}` : ''}
                    </span>
                </span>
            ) : null}
        </div>
    );
}
