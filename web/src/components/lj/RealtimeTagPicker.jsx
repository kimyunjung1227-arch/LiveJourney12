import React, { useMemo, useState } from 'react';
import { LJ } from './tokens';
import {
  WEATHER_TAGS,
  WEATHER_TAG_SNOW,
  FEEL_TAGS,
  OUTFIT_TAGS,
  SCENE_TAGS,
  SEASON_TAGS,
  SEASON_LABEL,
  getSeasonKey,
  tagStr,
  emptyTagGroups,
} from '../../utils/realtimeTags';

/**
 * 실시간 태그 선택 칩 — 업로드 정보 화면과 게시물 수정 화면이 같은 모양으로 쓴다.
 *
 * value: { weather, feel[], outfit, scene[], season[], extra[] }
 * onChange: 다음 value 를 통째로 돌려준다.
 *
 * 화면에 한 번에 보이는 칩은 12개 이하로 유지 — 옷차림·현장·시즌은 "더보기" 안에 접어 둔다.
 * (수정 화면처럼 접힌 군에 이미 고른 값이 있으면 처음부터 펼쳐 준다)
 */
export function RealtimeTagPicker({ value, onChange }) {
  const groups = value || emptyTagGroups();
  const hasHiddenSelection =
    !!groups.outfit || (groups.scene || []).length > 0 || (groups.season || []).length > 0;
  const [moreOpen, setMoreOpen] = useState(hasHiddenSelection);

  // 이번 계절(브라우저 현재 시각 기준) — 시즌 태그 + 겨울 눈 노출 판단
  const seasonKey = useMemo(() => getSeasonKey(new Date().getMonth() + 1), []);
  const weatherOptions = useMemo(() => {
    // 겨울이 아니어도 이미 "눈"이 골라져 있으면(예전 게시물 수정) 칩을 남겨 둔다
    const showSnow = seasonKey === 'winter' || groups.weather === tagStr(WEATHER_TAG_SNOW);
    return showSnow ? [...WEATHER_TAGS, WEATHER_TAG_SNOW] : WEATHER_TAGS;
  }, [seasonKey, groups.weather]);
  // 이미 고른 시즌 태그는 계절이 지나도 계속 보이게 (수정 시 지워지지 않도록)
  const seasonOptions = useMemo(() => {
    const current = SEASON_TAGS[seasonKey] || [];
    const picked = groups.season || [];
    const extras = Object.values(SEASON_TAGS)
      .flat()
      .filter((t) => picked.includes(tagStr(t)) && !current.some((c) => c.label === t.label));
    return [...current, ...extras];
  }, [seasonKey, groups.season]);

  const patch = (next) => onChange?.({ ...groups, ...next });
  const toggleSingle = (key) => (val) => patch({ [key]: groups[key] === val ? '' : val });
  const toggleMulti = (key) => (val) => {
    const list = groups[key] || [];
    patch({ [key]: list.includes(val) ? list.filter((v) => v !== val) : [...list, val] });
  };

  const chipStyle = (active) => ({
    minHeight: 0,
    minWidth: 0,
    padding: '8px 13px',
    borderRadius: 999,
    border: `1px solid ${active ? LJ.key : LJ.borderLight}`,
    background: active ? LJ.key : LJ.bgSurface,
    color: active ? '#fff' : LJ.textSecondary,
    fontFamily: LJ.fontStack,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    transition: 'background 120ms, color 120ms, border-color 120ms',
  });
  const renderChip = (t, active, onClick) => (
    <button key={t.label} type="button" onClick={onClick} aria-pressed={active} style={chipStyle(active)}>
      {t.label}
    </button>
  );
  const chipRow = (children) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{children}</div>
  );

  return (
    <>
      {/* 1군 하늘 — 필수·단일 */}
      <TagGroupHeader label="하늘" required />
      {chipRow(
        weatherOptions.map((t) =>
          renderChip(t, groups.weather === tagStr(t), () => toggleSingle('weather')(tagStr(t)))
        )
      )}

      {/* 2군 체감 — 선택·다중 (사진에 안 찍히는 정보) */}
      <TagGroupHeader label="체감" />
      {chipRow(
        FEEL_TAGS.map((t) =>
          renderChip(t, (groups.feel || []).includes(tagStr(t)), () => toggleMulti('feel')(tagStr(t)))
        )
      )}

      {/* 더보기: 시즌 + 옷차림 + 현장 (기본 접힘 — 화면 칩 12개 이하 유지) */}
      {!moreOpen ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            style={{
              minHeight: 0,
              background: 'transparent',
              border: 'none',
              padding: '2px 0 6px',
              color: LJ.key,
              fontFamily: LJ.fontStack,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            더보기
          </button>
        </div>
      ) : (
        <>
          {seasonOptions.length > 0 && (
            <>
              <TagGroupHeader label={`${SEASON_LABEL[seasonKey]} 시즌`} />
              {chipRow(
                seasonOptions.map((t) =>
                  renderChip(t, (groups.season || []).includes(tagStr(t)), () =>
                    toggleMulti('season')(tagStr(t))
                  )
                )
              )}
            </>
          )}
          <TagGroupHeader label="옷차림" />
          {chipRow(
            OUTFIT_TAGS.map((t) =>
              renderChip(t, groups.outfit === tagStr(t), () => toggleSingle('outfit')(tagStr(t)))
            )
          )}
          <TagGroupHeader label="현장" />
          {chipRow(
            SCENE_TAGS.map((t) =>
              renderChip(t, (groups.scene || []).includes(tagStr(t)), () =>
                toggleMulti('scene')(tagStr(t))
              )
            )
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              style={{
                minHeight: 0,
                background: 'transparent',
                border: 'none',
                padding: '0 0 8px',
                color: LJ.textTertiary,
                fontFamily: LJ.fontStack,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              접기
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** 라벨만 노출 (필수 그룹만 빨간 점). "선택"·설명 문구는 군더더기라 표시하지 않는다. */
export function TagGroupHeader({ label, required = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 8px' }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: LJ.textPrimary }}>{label}</span>
      {required && (
        <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: LJ.error }} />
      )}
    </div>
  );
}

export default RealtimeTagPicker;
