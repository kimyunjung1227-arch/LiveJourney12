import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';
import { getBadgeDisplayName, hydrateBadgeFromName } from '../utils/badgeSystem';
import LiveBadgeMedallion from '../components/LiveBadgeMedallion';

const TIER_THRESHOLDS = {
  season: [1, 3, 6],
  value: [1, 3, 6],
  region: [5, 20, 50],
};

function parseDynMeta(name) {
  const n = String(name || '');
  if (!n.startsWith('dyn:')) return null;
  const raw = n.slice('dyn:'.length);
  const parts = raw.split(':');
  if (!parts.length) return null;
  const kind = parts[0];
  const tierPart = parts[parts.length - 1] || '';
  const tier = Number(tierPart.replace(/^tier/, '')) || 1;
  return { kind, parts, tier };
}

function buildNextDynName(meta) {
  const kind = meta?.kind;
  const tier = Number(meta?.tier || 1);
  const nextTier = Math.min(3, tier + 1);
  const parts = [...(meta?.parts || [])];
  if (parts.length === 0) return null;
  parts[parts.length - 1] = `tier${nextTier}`;
  return `dyn:${parts.join(':')}`;
}

function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function sectionTitle(text) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {text}
    </h2>
  );
}

const LiveBadgeDetailScreen = () => {
  const navigate = useNavigate();
  const { badgeName: badgeNameParam } = useParams();
  const location = useLocation();

  const badgeFromState = location.state?.badge || null;
  const badgeName = badgeFromState?.name || (badgeNameParam ? decodeURIComponent(badgeNameParam) : '');

  const current = useMemo(() => {
    if (badgeFromState) return badgeFromState;
    const hydrated = hydrateBadgeFromName(badgeName);
    return hydrated ? { ...hydrated, name: badgeName } : { name: badgeName };
  }, [badgeFromState, badgeName]);

  const meta = useMemo(() => parseDynMeta(current?.name), [current?.name]);

  const next = useMemo(() => {
    if (!meta) return null;
    if ((meta.tier || 1) >= 3) return null;
    const nextName = buildNextDynName(meta);
    const hydrated = hydrateBadgeFromName(nextName);
    return hydrated ? { ...hydrated, name: nextName } : { name: nextName };
  }, [meta]);

  const currentLabel = getBadgeDisplayName(current) || current?.displayName || current?.name || '라이브뱃지';
  const nextLabel = next ? getBadgeDisplayName(next) || next?.displayName || next?.name : null;

  const kind = meta?.kind || null;
  const thresholds = kind && TIER_THRESHOLDS[kind] ? TIER_THRESHOLDS[kind] : null;
  const currentTier = Number(meta?.tier || 1);
  const nextTarget = thresholds ? thresholds[Math.min(2, currentTier)] : (current?.progressTarget || null);
  const curCount = typeof current?.progressCurrent === 'number' ? current.progressCurrent : 0;
  const pct = nextTarget ? clamp01(curCount / nextTarget) : clamp01((current?.getProgress?.() || 0) / 100);

  const hasDynLadder = Boolean(meta);
  const hasNextStage = Boolean(next);
  const isDynMaxTier = hasDynLadder && !hasNextStage;

  const earnedConditionText =
    current?.shortCondition?.trim() ||
    (nextTarget != null
      ? `누적 진행 ${curCount} / ${nextTarget}${current?.progressUnit ? ` ${current.progressUnit}` : ''}`
      : '활동 기록을 쌓아 획득한 라이브뱃지입니다.');

  const descriptionText =
    current?.description?.trim() ||
    '활동을 통해 성장하는 라이브뱃지입니다. 실시간 기록을 쌓아 다음 단계에 도전해 보세요.';

  const nextConditionText = hasNextStage
    ? (next?.shortCondition?.trim() ||
        (nextTarget != null
          ? `다음 단계까지 ${nextTarget}${current?.progressUnit ? ` ${current.progressUnit}` : ''} 달성`
          : '다음 단계 조건을 확인하려면 프로필에서 활동을 이어가 주세요.'))
    : isDynMaxTier
      ? '이 뱃지는 최고 단계까지 달성했습니다.'
      : '이 뱃지는 단계형 진행 정보가 없습니다. 활동을 이어가면 새로운 뱃지를 만날 수 있어요.';

  const statusLine = hasNextStage
    ? `현재 ${curCount} / 목표 ${nextTarget ?? current?.progressTarget ?? 0}${current?.progressUnit ? ` ${current.progressUnit}` : ''}`
    : isDynMaxTier
      ? '최고 단계 달성'
      : '진행률 정보 없음';

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
      <div className="screen-content">
        <header className="screen-header bg-white dark:bg-gray-900 flex items-center p-4 gap-3 border-b border-gray-100 dark:border-gray-800">
          <BackButton onClick={() => navigate(-1)} />
          <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold truncate flex-1">
            라이브뱃지 상세
          </h1>
        </header>

        <div className="screen-body bg-white dark:bg-gray-900 px-4 py-6 pb-24 space-y-5">
          {/* 현재 획득한 뱃지: 아이콘 중앙 → (아이콘 아래) 설명 → 달성 조건 */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            {sectionTitle('현재 획득한 뱃지')}

            <div className="mt-4 flex flex-col items-center text-center">
              <LiveBadgeMedallion
                badgeName={current?.name}
                tier={current?.difficulty}
                icon={current?.icon}
                gradientCss={current?.gradientCss}
                size={92}
                className="mx-auto"
              />
              <div className="mt-3 text-base font-extrabold text-gray-900 dark:text-gray-100">
                {currentLabel}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                {sectionTitle('설명')}
                <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300 break-keep">
                  {descriptionText}
                </p>
              </div>
              <div>
                {sectionTitle('달성 조건')}
                <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-gray-200 break-keep">
                  {earnedConditionText}
                </p>
              </div>
            </div>
          </section>

          {/* 다음 뱃지: (좌) 달성조건/진행사항 → (우) 아이콘 */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            {sectionTitle('다음 뱃지')}

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100 truncate">
                  {hasNextStage ? (nextLabel || '다음 뱃지') : isDynMaxTier ? '최고 단계' : '다음 뱃지'}
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    {sectionTitle('달성 조건')}
                    <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-gray-200 break-keep">
                      {nextConditionText}
                    </p>
                  </div>

                  <div>
                    {sectionTitle('진행 사항')}
                    {hasNextStage ? (
                      <>
                        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.round(pct * 100)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{statusLine}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{statusLine}</p>
                    )}
                  </div>
                </div>
              </div>

              <LiveBadgeMedallion
                badgeName={next?.name || current?.name}
                tier={next?.difficulty || Math.min(3, (Number(current?.difficulty || meta?.tier || 1) || 1) + 1)}
                icon={next?.icon || current?.icon}
                gradientCss={next?.gradientCss}
                size={72}
                className="shrink-0"
              />
            </div>
          </section>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default LiveBadgeDetailScreen;
