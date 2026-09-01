import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconBookmark, IconBookmarkFilled, IconShare3 } from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import BestCutsCarousel from '../components/lj/BestCutsCarousel';
import PlaceLiveStatus from '../components/lj/PlaceLiveStatus';
import PlaceVisitorReports from '../components/lj/PlaceVisitorReports';
import PlaceAboutBox from '../components/lj/PlaceAboutBox';
import PlaceRecentPhotos from '../components/lj/PlaceRecentPhotos';
import {
  summarizePlaceLiveStatus,
  buildLiveStatusView,
  buildPlaceLiveSentence,
} from '../utils/placeLiveStatus';
import { usePlaceDetail } from '../hooks/usePlaceDetail';
import { bestCutScore } from '../hooks/ljPostsMapping';
import { useAuth } from '../contexts/AuthContext';
import { isPlaceSaved, toggleSavedPlace } from '../api/savedPlacesSupabase';
import { getWeatherByRegion } from '../api/weather';
import WeatherIcon from '../components/WeatherIcon';

const BEST_CUT_LIMIT = 1;

/**
 * 장소 페이지 (/place/:placeId) — 실시간 핫플 상세.
 *
 * 사진 나열이 아니라 "왜 지금 이곳이 핫플인지"를 정보로 설명하는 순서로 둔다.
 *   헤더(장소명·기온) → 베스트 컷 1장 → 지금 이곳은(요약 + 하늘/체감/옷차림/사람)
 *   → 방문자 제보 → 이곳은 어떤 곳인가요 → 최근 사진(접힘)
 */
function PlaceDetailScreen() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { place, posts, loading } = usePlaceDetail(placeId);
  const [bookmarked, setBookmarked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [weather, setWeather] = useState({ icon: '☀️', temperature: '', condition: '' });

  const placeName = place?.name || '';

  // 헤더 장소명 옆 실시간 기온 — 지역(region) 우선, 없으면 장소명으로 조회
  useEffect(() => {
    const regionForWeather = (place?.region || place?.name || '').trim();
    if (!regionForWeather) return undefined;
    let alive = true;
    getWeatherByRegion(regionForWeather)
      .then((res) => {
        if (!alive || !res?.weather) return;
        setWeather({
          icon: res.weather.icon,
          temperature: res.weather.temperature,
          condition: res.weather.condition,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [place?.region, place?.name]);

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

  // 실시간 상태 집계 — 48h 안의 제보만, 최신일수록 크게 반영
  const liveStatus = useMemo(() => summarizePlaceLiveStatus(posts || []), [posts]);
  const liveView = useMemo(() => buildLiveStatusView(liveStatus, weather), [liveStatus, weather]);
  const liveSentence = useMemo(() => buildPlaceLiveSentence(liveView), [liveView]);

  // 장소 소개(Claude) 프롬프트 힌트로 쓸 대표 태그
  const placeTags = useMemo(
    () => [...(liveStatus.seasons || []), liveStatus.sky, liveStatus.crowd].filter(Boolean),
    [liveStatus],
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
        paddingBottom: 48,
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

          {/* 중앙 장소명 + 실시간 기온 칩 (좌우 버튼 영역만큼 여백 두고 ellipsis 처리) */}
          <div
            style={{
              position: 'absolute',
              left: 80,
              right: 80,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                minWidth: 0,
                fontSize: 16,
                fontWeight: 600,
                color: LJ.textPrimary,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {place?.name || '장소'}
            </span>
            {weather.temperature && weather.temperature !== '-' && (
              <span
                title={weather.condition}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#f1f5f9',
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                <WeatherIcon icon={weather.icon} condition={weather.condition} size={14} />
                <span style={{ color: '#334155' }}>{weather.temperature}</span>
              </span>
            )}
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

      {/* 베스트 컷 — 대표 한 장만 남기고, 아래부터는 정보가 주인공 */}
      {bestCuts.length > 0 && (
        <BestCutsCarousel
          posts={bestCuts}
          onPostClick={(p) => navigate(`/post/${p.id}`)}
          onAuthorClick={(p) => navigate(`/user/${p.author?.id || p.author_id}`)}
        />
      )}

      {loading && posts.length === 0 ? (
        <div
          style={{
            padding: '40px 18px',
            textAlign: 'center',
            color: LJ.textSecondary,
            fontSize: 12,
          }}
        >
          지금 이곳의 정보를 모으는 중...
        </div>
      ) : (
        <>
          {/* 지금 이곳은 — 이 장소가 왜 지금 핫플인지 */}
          <PlaceLiveStatus
            sentence={liveSentence}
            view={liveView}
            reportCount={liveStatus.reportCount}
            latestMs={liveStatus.latestMs}
          />

          {/* 방문자 제보 — 사람 말로 확인하는 현장 */}
          <PlaceVisitorReports posts={posts} onSelect={(p) => navigate(`/post/${p.id}`)} />

          {/* 장소 배경 설명 */}
          <PlaceAboutBox placeName={placeName} region={place?.region || ''} tags={placeTags} />

          {/* 최근 사진 — 기본 3장, 누르면 펼침 */}
          <PlaceRecentPhotos posts={gridPosts} onPhotoClick={(id) => navigate(`/post/${id}`)} />
        </>
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
