import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconChevronDown,
  IconWorld,
  IconMap,
  IconHome,
} from '@tabler/icons-react';
import BottomNavigation from '../components/BottomNavigation';
import { LJ } from '../components/lj/tokens';
import EmptyState from '../components/lj/EmptyState';
import HotplaceTopCard from '../components/lj/HotplaceTopCard';
import HotplaceListItem from '../components/lj/HotplaceListItem';
import { useHotplaceRanking } from '../hooks/useHotplaceRanking';
import { reverseGeocodeToPlaceDetail } from '../utils/locationFromGeocode';

const INITIAL = 20;
const STEP = 5;
const MAX = 50;

const SIZES = ['large', 'medium', 'small'];
const RANK_LABELS = ['HOT 1위', 'UP 2위', '3위'];
const RANK_ICONS = ['flame', 'trending', null];

/**
 * 실시간 핫플 화면 (/hotplace).
 * - 상단 라이브 인디케이터
 * - 1~3위 강조 카드 (HotplaceTopCard)
 * - 4~20위 리스트 (HotplaceListItem)
 * - 하단 "전체 보기" 버튼
 */
const SCOPE_OPTIONS = [
  { id: 'national', label: '전국', icon: IconWorld },
  { id: 'region', label: '지역', icon: IconMap },
  { id: 'local', label: '동네', icon: IconHome },
];

// 범위 필터(전국/지역/동네) 노출 여부. false면 기본 '전국' 그대로 핫플 바로 노출.
// 코드는 보존하고 UI만 숨김 — 다시 켜려면 true로.
const SHOW_SCOPE_FILTER = false;

function HotplaceScreen() {
  const navigate = useNavigate();
  const [limit, setLimit] = useState(INITIAL);
  const [scope, setScope] = useState('national');
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef(null);

  // 사용자 위치 — 전국이 아닌 범위(지역/동네)일 때 사용
  const [userCoords, setUserCoords] = useState(null);
  const [userRegion1depth, setUserRegion1depth] = useState('');
  const [locStatus, setLocStatus] = useState('idle'); // 'idle' | 'requesting' | 'granted' | 'denied'

  // 스코프가 전국 외로 바뀌면 1회 위치/지역 요청
  useEffect(() => {
    if (scope === 'national') return undefined;
    if (userCoords) return undefined;
    if (locStatus === 'requesting') return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocStatus('denied');
      return undefined;
    }
    setLocStatus('requesting');
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        setLocStatus('granted');
        // 1depth 지역명도 함께 확보 (지역 필터에 사용)
        reverseGeocodeToPlaceDetail(lat, lng)
          .then((d) => {
            if (cancelled) return;
            const first = String(d?.region || '').trim().split(/\s+/)[0] || '';
            setUserRegion1depth(first);
          })
          .catch(() => {});
      },
      () => {
        if (!cancelled) setLocStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
    return () => { cancelled = true; };
  }, [scope, userCoords, locStatus]);

  const { ranking, loading } = useHotplaceRanking({
    limit,
    scope,
    userCoords,
    userRegion1depth,
  });

  // 외부 클릭으로 드롭다운 닫기
  useEffect(() => {
    if (!scopeOpen) return;
    const handler = (e) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target)) setScopeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [scopeOpen]);

  const currentScope = SCOPE_OPTIONS.find((o) => o.id === scope) || SCOPE_OPTIONS[0];
  const CurrentIcon = currentScope.icon;

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const canLoadMore = ranking.length >= limit && limit < MAX;

  const goPlace = (place_id) => () => navigate(`/place/${place_id}`);

  return (
    <div
      style={{
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        paddingBottom: 80,
      }}
    >
      {/* 헤더: [back] | (중앙 제목) | [전국/지역/동네] */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: '#fff',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
          }}
        >
          {/* 좌: 뒤로가기 (vertical center 보장) */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            style={{
              width: 32,
              height: 32,
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: LJ.textSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconArrowLeft size={18} stroke={1.8} />
          </button>

          {/* 중앙 제목 (absolute로 한가운데 고정) */}
          <h1
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: LJ.textPrimary,
              lineHeight: 1,
              letterSpacing: -0.2,
              pointerEvents: 'none',
            }}
          >
            실시간 핫플
          </h1>

          {/* 우: 범위 필터 드롭다운 — 기본 "전국", 누르면 아래로 펼쳐짐 (SHOW_SCOPE_FILTER로 숨김) */}
          {SHOW_SCOPE_FILTER && (
          <div ref={scopeRef} style={{ marginLeft: 'auto', position: 'relative' }}>
            <button
              type="button"
              onClick={() => setScopeOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={scopeOpen}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 4px',
                background: 'transparent',
                border: 'none',
                color: LJ.textPrimary,
                fontFamily: LJ.fontStack,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              <CurrentIcon size={14} stroke={1.7} color={LJ.textSecondary} />
              <span>{currentScope.label}</span>
              <IconChevronDown
                size={13}
                stroke={2}
                color={LJ.textSecondary}
                style={{
                  transition: 'transform 150ms ease-out',
                  transform: scopeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>
            {scopeOpen && (
              <ul
                role="listbox"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: 120,
                  margin: 0,
                  padding: 6,
                  listStyle: 'none',
                  background: '#fff',
                  border: `1px solid ${LJ.borderLight}`,
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  zIndex: 40,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {SCOPE_OPTIONS.map((opt) => {
                  const Opt = opt.icon;
                  const active = scope === opt.id;
                  return (
                    <li key={opt.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => {
                          setScope(opt.id);
                          setScopeOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          background: active ? LJ.keyBgLight : 'transparent',
                          border: 'none',
                          borderRadius: 8,
                          color: active ? LJ.keyTextDark : LJ.textPrimary,
                          fontFamily: LJ.fontStack,
                          fontSize: 12.5,
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          lineHeight: 1.2,
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = LJ.bgSurface;
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Opt size={14} stroke={1.8} color={active ? LJ.key : LJ.textSecondary} />
                        {opt.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          )}
        </div>
      </header>

      {/* 범위별 상태 안내 (전국 외에서만) */}
      {scope !== 'national' && (
        <div
          style={{
            padding: '0 18px',
            margin: '4px 0 8px',
            fontSize: 11,
            color: LJ.textSecondary,
            lineHeight: 1.45,
          }}
        >
          {locStatus === 'requesting' ? (
            <span>내 위치 확인 중…</span>
          ) : locStatus === 'denied' ? (
            <span style={{ color: '#B45309' }}>
              위치 권한이 필요해요. 브라우저 위치 권한을 켜 주세요.
            </span>
          ) : scope === 'region' ? (
            <span>
              <strong style={{ color: LJ.textPrimary, fontWeight: 700 }}>
                {userRegion1depth || '내 지역'}
              </strong>
              {' '}내 핫플
            </span>
          ) : (
            <span>내 위치 반경 5km 핫플</span>
          )}
        </div>
      )}

      {/* 1~3위 강조 카드 */}
      {loading && ranking.length === 0 ? (
        <Skeleton />
      ) : ranking.length === 0 ? (
        <EmptyHotplace onUpload={() => navigate('/upload')} />
      ) : (
        <>
          <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {top3.map((item, i) => (
              <HotplaceTopCard
                key={item.place_id}
                rank={i + 1}
                rankLabel={RANK_LABELS[i]}
                rankIconName={RANK_ICONS[i]}
                place={item}
                bestCutPost={item.bestCutPost}
                recentPosts={item.recentPosts}
                size={SIZES[i]}
                onClick={goPlace(item.place_id)}
              />
            ))}
          </div>

          {/* 4~20위 라벨 + 리스트 */}
          {rest.length > 0 && (
            <>
              <div
                style={{
                  padding: '24px 18px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: LJ.textSecondary,
                  letterSpacing: 0.3,
                }}
              >
                4 ~ 20위
              </div>
              <div>
                {rest.map((item, i) => (
                  <React.Fragment key={item.place_id}>
                    <HotplaceListItem
                      rank={i + 4}
                      place={item}
                      postsCount={item.postsCount}
                      growthRate={item.growthRate}
                      bestCutPost={item.bestCutPost}
                      recentPosts={item.recentPosts}
                      onClick={goPlace(item.place_id)}
                    />
                    <div
                      style={{
                        height: 1,
                        background: LJ.borderLight,
                        margin: '0 18px',
                      }}
                    />
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          {canLoadMore && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 12px' }}>
              <button
                type="button"
                onClick={() => setLimit((n) => Math.min(MAX, n + STEP))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '10px 18px',
                  background: '#fff',
                  border: `1px solid ${LJ.borderLight}`,
                  borderRadius: 999,
                  color: LJ.textSecondary,
                  fontFamily: LJ.fontStack,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                더보기 <IconChevronDown size={14} stroke={2} />
              </button>
            </div>
          )}
        </>
      )}

      <BottomNavigation />
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: '#fff',
            border: `1.5px solid ${LJ.borderLight}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 180, background: LJ.bgSurface }} />
          <div style={{ padding: 14 }}>
            <div style={{ height: 12, width: '40%', background: LJ.bgSurface, borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 10, width: '60%', background: LJ.bgSurface, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyHotplace({ onUpload }) {
  return (
    <EmptyState
      padding="64px 24px"
      title="아직 활동 중인 핫플이 없어요"
      description={
        <>
          지금 있는 곳을 한 장 올려보세요.
          <br />
          당신의 한 장이 첫 핫플이 될 수도 있어요.
        </>
      }
      actionLabel="사진 한 장 올리기"
      onAction={onUpload}
    />
  );
}

export default HotplaceScreen;
