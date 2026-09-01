import React from 'react';
import { LJ, formatExifTime } from './tokens';

/**
 * 장소 상세 "지금 이곳은" 블록.
 *  1) 제보를 합쳐 만든 한 문단 — 왜 지금 이 장소인지 한눈에
 *  2) 하늘 / 체감 / 옷차림 / 사람 4칸 — 사진에는 안 찍히는 정보
 *  3) 주차 만차·통제 중 같은 현장 특이사항 칩
 *
 * 값이 없는 칸은 "제보 없음"으로 비워 둔다(추정으로 채우지 않는다).
 */

const CELL_LABELS = [
  { key: 'sky', label: '하늘' },
  { key: 'feel', label: '체감' },
  { key: 'outfit', label: '옷차림' },
  { key: 'crowd', label: '사람' },
];

function StatusCell({ label, cell }) {
  const value = cell?.value || '';
  return (
    <div
      style={{
        background: LJ.bgSurface,
        borderRadius: 10,
        padding: '10px 12px 11px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: LJ.textSecondary, lineHeight: 1.2 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 5,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.25,
          color: value ? LJ.textPrimary : LJ.textTertiary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value || '제보 없음'}
      </div>
    </div>
  );
}

export function PlaceLiveStatus({ sentence, view, reportCount = 0, latestMs = 0 }) {
  const hasAnyCell = CELL_LABELS.some(({ key }) => view?.[key]?.value);
  if (!sentence && !hasAnyCell) {
    return (
      <section style={{ padding: '18px 18px 0', fontFamily: LJ.fontStack }}>
        <div
          style={{
            background: LJ.bgSurface,
            borderRadius: 12,
            padding: '16px 14px',
            fontSize: 12.5,
            lineHeight: 1.6,
            color: LJ.textSecondary,
          }}
        >
          아직 이곳의 실시간 제보가 없어요. 지금 모습을 올리면 첫 제보가 됩니다.
        </div>
      </section>
    );
  }

  const timeText = latestMs ? formatExifTime(new Date(latestMs).toISOString()) : '';

  return (
    <section style={{ padding: '18px 18px 0', fontFamily: LJ.fontStack }}>
      {/* 1) 한 문단 요약 */}
      {sentence && (
        <div style={{ borderLeft: `3px solid ${LJ.key}`, paddingLeft: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: LJ.keyTextDark, letterSpacing: 0.2 }}>
            지금 이곳은
          </div>
          <p
            style={{
              margin: '5px 0 0',
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.55,
              color: LJ.textPrimary,
              wordBreak: 'keep-all',
            }}
          >
            {sentence}
          </p>
          {(reportCount > 0 || timeText) && (
            <div style={{ marginTop: 7, fontSize: 11, color: LJ.textTertiary, fontWeight: 500 }}>
              {reportCount > 0 ? `제보 ${reportCount}건` : '제보 집계 중'}
              {timeText ? ` · ${timeText} 기준` : ''}
            </div>
          )}
        </div>
      )}

      {/* 2) 4칸 상태 */}
      <div
        style={{
          marginTop: sentence ? 14 : 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}
      >
        {CELL_LABELS.map(({ key, label }) => (
          <StatusCell key={key} label={label} cell={view?.[key]} />
        ))}
      </div>

      {/* 3) 현장 특이사항 */}
      {view?.notices?.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {view.notices.map((n) => (
            <span
              key={n}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 10px',
                borderRadius: 999,
                background: LJ.keyBgLight,
                color: LJ.keyTextDark,
                fontSize: 11.5,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {n}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export default PlaceLiveStatus;
