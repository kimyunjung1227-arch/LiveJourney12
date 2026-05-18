import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconArrowLeft, IconFlame } from '@tabler/icons-react'; // IconFlame은 빈 상태에서만 사용
import BottomNavigation from '../components/BottomNavigation';
import { LJ } from '../components/lj/tokens';
import HotplaceTopCard from '../components/lj/HotplaceTopCard';
import HotplaceListItem from '../components/lj/HotplaceListItem';
import { useHotplaceRanking } from '../hooks/useHotplaceRanking';

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
function HotplaceScreen() {
  const navigate = useNavigate();
  const { ranking, loading } = useHotplaceRanking({ limit: 20 });

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

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
      {/* 헤더 */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              color: LJ.textSecondary,
              display: 'inline-flex',
            }}
          >
            <IconArrowLeft size={20} stroke={1.8} />
          </button>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: LJ.textPrimary }}>
            실시간 핫플
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/search')}
          aria-label="검색"
          style={{
            width: 32,
            height: 32,
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: LJ.textSecondary,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconSearch size={20} stroke={1.7} />
        </button>
      </header>

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
                postsCount={item.postsCount}
                growthRate={item.growthRate}
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

          {/* 전체 보기 (현재는 시각 placeholder, 같은 화면을 그대로 보여줌) */}
          <button
            type="button"
            onClick={() => navigate(0)}
            style={{
              display: 'block',
              margin: '20px auto 12px',
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
            전체 20위까지 모두 보기
          </button>
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
    <div style={{ padding: '64px 24px', textAlign: 'center', color: LJ.textSecondary, fontFamily: LJ.fontStack }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: LJ.keyBgLight,
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: LJ.key,
        }}
      >
        <IconFlame size={28} stroke={1.8} />
      </div>
      <p style={{ margin: 0, color: LJ.textPrimary, fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
        아직 활동 중인 핫플이 없어요
      </p>
      <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
        지금 있는 곳을 한 장 올려보세요.
        <br />
        당신의 한 장이 첫 핫플이 될 수도 있어요.
      </p>
      <button
        type="button"
        onClick={onUpload}
        style={{
          marginTop: 18,
          padding: '11px 18px',
          background: LJ.key,
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontFamily: LJ.fontStack,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        사진 한 장 올리기
      </button>
    </div>
  );
}

export default HotplaceScreen;
