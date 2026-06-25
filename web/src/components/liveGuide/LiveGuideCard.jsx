import React from 'react';
import LiveGuideBadge from './LiveGuideBadge';
import { liveGuideLabel, formatTimeLeft } from '../../utils/liveGuide';

/**
 * 라이브가이드 상태 카드 — "이미 가이드인 사람"에게만 보인다.
 * (달성 조건/진행은 대놓고 노출하지 않고, 달성 순간 축하 연출로 대신한다.)
 * 비가이드(none/building/lapsed) 상태에서는 아무것도 렌더하지 않는다.
 *
 * @param {object} props
 * @param {object} props.data useLiveGuide() 결과
 */

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const AMBER = '#E8930C';
const TRACK = '#EEF4F8';

function ProgressBar({ value, max, fill = GRADIENT }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: 6, borderRadius: 999, background: TRACK, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: fill, transition: 'width .4s ease' }} />
    </div>
  );
}

function Shell({ children, accent = KEY }) {
  return (
    <div
      style={{
        margin: '4px 18px 14px',
        padding: '13px 14px',
        borderRadius: 14,
        background: '#fff',
        border: `1px solid ${accent}33`,
        boxShadow: `0 1px 0 ${accent}14`,
      }}
    >
      {children}
    </div>
  );
}

export default function LiveGuideCard({ data }) {
  // 가이드가 아닌 동안에는 노출하지 않는다 (조건/진행을 대놓고 보여주지 않음)
  if (!data || data.loading || !data.isGuide) return null;

  const { status, level, maintainCount, isLive, expiresAt, nextLevelMin, toNext, maintainRemaining, maintainMonths } =
    data;

  // ── 곧 종료 경고 (fading) ──────────────────────────────────
  if (status === 'fading') {
    const left = formatTimeLeft(expiresAt);
    return (
      <Shell accent={AMBER}>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
          <LiveGuideBadge level={level} size={22} />
          <span style={{ fontSize: 14, fontWeight: 800, color: AMBER }}>라이브가이드가 곧 종료돼요</span>
        </div>
        <p className="m-0" style={{ fontSize: 12.5, lineHeight: 1.5, color: TEXT_SECONDARY }}>
          최근 활동이 부족해요. 최근 {maintainMonths}개월에 <b style={{ color: AMBER }}>{maintainRemaining}건</b>만 더
          올리면 유지돼요.
          {left && (
            <>
              {' '}
              유지 기한 <b style={{ color: AMBER }}>{left}</b> 남음.
            </>
          )}
        </p>
      </Shell>
    );
  }

  // ── 라이브가이드 (active / top) ─────────────────────────────
  const left = formatTimeLeft(expiresAt);
  return (
    <Shell>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
        <LiveGuideBadge level={level} live={isLive} size={22} />
        <span style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}>{liveGuideLabel(level)}</span>
        {isLive && (
          <span
            className="flex items-center"
            style={{ gap: 4, marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: KEY_DARK }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: KEY }} />
            실시간 활동 중
          </span>
        )}
      </div>
      <p className="m-0" style={{ fontSize: 12.5, lineHeight: 1.5, color: TEXT_SECONDARY, marginBottom: 6 }}>
        최근 {maintainMonths}개월 동안 <b style={{ color: TEXT_PRIMARY }}>{maintainCount}건</b>의 살아있는 정보를
        제공했어요.
        {left && (
          <>
            {' '}
            유지 기한 <b style={{ color: TEXT_PRIMARY }}>{left}</b> 남음.
          </>
        )}
      </p>
      {nextLevelMin ? (
        <>
          <div className="flex items-center justify-between" style={{ marginTop: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY }}>
              {level >= 2 ? '탑 라이브가이드' : '활발'}까지 {toNext}건
            </span>
            <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
              {maintainCount}/{nextLevelMin}
            </span>
          </div>
          <ProgressBar value={maintainCount} max={nextLevelMin} />
        </>
      ) : (
        <p className="m-0" style={{ fontSize: 11, color: KEY_DARK, fontWeight: 700 }}>
          최고 등급이에요. 꾸준히 올려서 유지해요!
        </p>
      )}
    </Shell>
  );
}
