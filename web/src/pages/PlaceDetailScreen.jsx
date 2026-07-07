import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconBookmark, IconBookmarkFilled, IconShare3 } from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import BestCutsCarousel from '../components/lj/BestCutsCarousel';
import PlacePhotoGrid from '../components/lj/PlacePhotoGrid';
import { usePlaceDetail } from '../hooks/usePlaceDetail';
import { bestCutScore } from '../hooks/ljPostsMapping';
import { useAuth } from '../contexts/AuthContext';
import { isPlaceSaved, toggleSavedPlace } from '../api/savedPlacesSupabase';

const BEST_CUT_LIMIT = 1;

/**
 * 장소 페이지 (/place/:placeId).
 * 단순화: 헤더 → BestCutHero → 사진 그리드(베스트컷 제외) → CTA
 * (상태박스 / 카테고리 필터 제거)
 */
function PlaceDetailScreen() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { place, posts, loading } = usePlaceDetail(placeId);
  const [bookmarked, setBookmarked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const placeName = place?.name || '';

  // 진입 시 저장 여부 동기화
  useEffect(() => {
    let alive = true;
    if (!isAuthenticated || !user?.id || !placeName) {
      setBookmarked(false);
      return;
    }
    isPlaceSaved(user.id, placeName).then((saved) => {
      if (alive) setBookmarked(saved);
    });
    return () => {
      alive = false;
    };
  }, [isAuthenticated, user?.id, placeName]);

  // 토스트 자동 숨김
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggleSave = async () => {
    if (!isAuthenticated || !user?.id) {
      setToast('로그인 후 저장할 수 있어요');
      return;
    }
    if (!placeName || saving) return;
    const next = !bookmarked;
    setSaving(true);
    setBookmarked(next); // 낙관적 업데이트
    const res = await toggleSavedPlace({
      userId: user.id,
      placeName,
      region: place?.region || '',
      savedBefore: bookmarked,
    });
    setSaving(false);
    if (!res.success) {
      setBookmarked(!next); // 실패 시 롤백
      setToast('잠시 후 다시 시도해 주세요');
      return;
    }
    setToast(res.saved ? '저장했어요 · 프로필에서 볼 수 있어요' : '저장을 해제했어요');
  };

  // 베스트 컷 캐러셀에 보일 상위 후보들 (점수 내림차순)
  const bestCuts = useMemo(() => {
    const arr = (posts || []).slice();
    arr.sort((a, b) => bestCutScore(b) - bestCutScore(a));
    return arr.slice(0, BEST_CUT_LIMIT);
  }, [posts]);

  // 그리드는 베스트 컷 캐러셀에 포함된 게시물 제외
  const bestCutIds = useMemo(() => new Set(bestCuts.map((p) => p.id)), [bestCuts]);
  const gridPosts = useMemo(
    () => (posts || []).filter((p) => !bestCutIds.has(p.id)),
    [posts, bestCutIds],
  );

  const handleShare = async () => {
    const url = window.location.href;
    const title = place?.name || 'Live Journey';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(url);
      alert('링크를 복사했어요');
    } catch (_) {}
  };

  return (
    <div
      style={{
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        paddingBottom: 24,
      }}
    >
      {/* 헤더: [back] (중앙 장소명) [북마크][공유] */}
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
              color: LJ.textPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconArrowLeft size={18} stroke={2} />
          </button>

          {/* 중앙 장소명 (좌우 버튼 영역만큼 padding 두고 ellipsis 처리) */}
          <div
            style={{
              position: 'absolute',
              left: 80,
              right: 80,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 16,
              fontWeight: 600,
              color: LJ.textPrimary,
              lineHeight: 1,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
            }}
          >
            {place?.name || '장소'}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={saving}
              aria-label={bookmarked ? '저장 해제' : '저장하기'}
              aria-pressed={bookmarked}
              style={{
                width: 32,
                height: 32,
                padding: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: saving ? 'wait' : 'pointer',
                color: bookmarked ? LJ.key : LJ.textSecondary,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {bookmarked ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} stroke={2} />}
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="공유"
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
              <IconShare3 size={20} stroke={2} />
            </button>
          </div>
        </div>
      </header>

      {/* 베스트 컷 캐러셀 — 게시물 수만큼 좌우 슬라이드 */}
      {bestCuts.length > 0 && (
        <>
          <BestCutsCarousel
            posts={bestCuts}
            onPostClick={(p) => navigate(`/post/${p.id}`)}
            onAuthorClick={(p) => navigate(`/user/${p.author?.id || p.author_id}`)}
          />
          {/* 베스트 컷 아래 가벼운 캡션 — 좌측 배치, 베스트 컷을 더 강조 */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 18px 0',
              fontSize: 11,
              fontWeight: 500,
              color: LJ.textTertiary,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: LJ.key,
                opacity: 0.8,
              }}
            />
            실시간 사진
          </div>
        </>
      )}

      {/* 사진 그리드 */}
      {loading && posts.length === 0 ? (
        <div
          style={{
            padding: '40px 18px',
            textAlign: 'center',
            color: LJ.textSecondary,
            fontSize: 12,
          }}
        >
          사진을 불러오는 중...
        </div>
      ) : (
        <PlacePhotoGrid posts={gridPosts} onPhotoClick={(id) => navigate(`/post/${id}`)} />
      )}

      {/* 저장 토스트 */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 28,
            transform: 'translateX(-50%)',
            zIndex: 60,
            maxWidth: 'calc(100% - 48px)',
            padding: '10px 16px',
            background: 'rgba(31,31,31,0.92)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 999,
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default PlaceDetailScreen;
