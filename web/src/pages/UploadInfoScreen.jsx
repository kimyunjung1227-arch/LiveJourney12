import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconShieldCheck,
  IconMapPin,
  IconClock,
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
  IconInfoCircle,
} from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import {
  getUploadSnapshot,
  subscribeUploadStore,
  resetUploadStore,
} from '../stores/uploadStore';
import { formatTimeAgo, formatTimeOfDay } from '../lib/exif/formatTimeAgo';
import { useUpload } from '../hooks/useUpload';
import { useGeolocation } from '../hooks/useGeolocation';
import { useQuestionBrief } from '../hooks/useQuestionBrief';
import QuestionBanner from '../components/answer/QuestionBanner';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { reverseGeocodeToPlace } from '../utils/locationFromGeocode';
import { searchPlaceWithKakaoFirst, ensureKakaoMapsServicesReady } from '../utils/kakaoPlacesGeocode';
import { patchUploadMedia } from '../stores/uploadStore';

const CATEGORIES = [
  { id: 'nature', label: '개화·자연', Icon: IconFlower },
  { id: 'weather', label: '날씨·체감', Icon: IconCloud },
  { id: 'event', label: '이벤트·축제', Icon: IconCalendarEvent },
  { id: 'crowd', label: '혼잡도·대기', Icon: IconUsers },
  { id: 'sunset', label: '노을·야경', Icon: IconMoon },
  { id: 'business', label: '영업·운영', Icon: IconBuildingStore },
];

const MAX_BODY = 100;

function UploadInfoScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const answerTo = searchParams.get('answerTo');
  const media = useSyncExternalStore(subscribeUploadStore, getUploadSnapshot, getUploadSnapshot);
  const { isUploading, upload, error } = useUpload();
  const geo = useGeolocation();
  const { question: answerQuestion } = useQuestionBrief(answerTo);
  const isAnswerMode = !!answerTo;

  const [category, setCategory] = useState(null);
  const [body, setBody] = useState('');
  // 화면에 표시할 장소명. 좌표 변경 시 항상 재지오코딩해 최신값을 보여준다.
  const [resolvedPlace, setResolvedPlace] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  // 사용자가 위치를 직접 편집한 경우의 좌표/장소 (있으면 media 값을 덮어씀)
  const [editedLoc, setEditedLoc] = useState(null); // { lat, lng, placeName } | null
  const [locOpen, setLocOpen] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [locLoading, setLocLoading] = useState(false);

  // 업로드 진입 시 한 번 더 정밀 GPS를 받아 좌표를 보정.
  // - 카메라 사진: 셔터 시점 watchPosition fix가 흔들렸을 수 있으니 무조건 한 번 갱신
  // - 갤러리 사진: EXIF에 GPS가 있으면 EXIF 우선 (좌표가 이미 정밀). 없으면 현재 위치로 채움
  // accuracy 게이트를 80m로 강화 — 더 부정확한 fix는 주변 매칭 위험이 있어 반영하지 않는다.
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!media?.url) return;
    if (editedLoc) return; // 사용자가 직접 수정했으면 그대로
    const hasExifGps = media.source === 'gallery' && media.exif?.gps;
    if (hasExifGps) return; // 갤러리 + EXIF GPS는 좌표가 이미 정확

    let cancelled = false;
    setRefreshing(true);
    (async () => {
      try {
        const fix = await geo.getPreciseLocation(9000);
        if (cancelled || !fix) return;
        if (typeof fix.accuracy === 'number' && fix.accuracy > 80) return; // 80m 초과는 반영 안 함
        patchUploadMedia({
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy ?? null,
          // 셔터 시점 placeName은 정밀 좌표 기준 재지오코드로 덮어쓸 거라 비움
          placeName: null,
        });
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.url, media?.source]);

  const refreshLocation = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setEditedLoc(null);
    try {
      const fix = await geo.getPreciseLocation(10000);
      if (!fix) return;
      patchUploadMedia({
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy ?? null,
        placeName: null,
      });
    } finally {
      setRefreshing(false);
    }
  };

  // 좌표가 잡혀 있으면 항상 좌표 기반으로 장소명을 재지오코딩한다.
  // (셔터 시점 media.placeName이 어긋났더라도, 좌표 기준의 정확한 건물명/POI로 갱신)
  useEffect(() => {
    if (!Number.isFinite(media?.lat) || !Number.isFinite(media?.lng)) {
      setResolvedPlace('');
      setGeocoding(false);
      return undefined;
    }
    let cancelled = false;
    setGeocoding(true);
    (async () => {
      try {
        const name = await reverseGeocodeToPlace(media.lat, media.lng);
        if (cancelled) return;
        setResolvedPlace(name || '');
      } catch (_) {
        if (!cancelled) setResolvedPlace('');
      } finally {
        if (!cancelled) setGeocoding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [media?.lat, media?.lng]);

  // 미디어가 없는 상태로 직접 진입하면 카메라로 유도 (답변 모드면 answerTo 유지)
  useEffect(() => {
    if (!media || !media.url) {
      const t = setTimeout(
        () =>
          navigate(
            answerTo ? `/camera?answerTo=${encodeURIComponent(answerTo)}` : '/camera',
            { replace: true },
          ),
        60,
      );
      return () => clearTimeout(t);
    }
  }, [media, navigate, answerTo]);

  // 답변 모드: 질문 카테고리를 기본 선택 (사용자가 직접 안 골랐을 때만)
  useEffect(() => {
    if (isAnswerMode && answerQuestion?.category && !category) {
      setCategory(answerQuestion.category);
    }
  }, [isAnswerMode, answerQuestion?.category, category]);

  const takenAtDate = useMemo(
    () => (media?.takenAt ? new Date(media.takenAt) : null),
    [media?.takenAt]
  );
  const takenLabel = useMemo(() => {
    if (!takenAtDate) return '';
    const rel = formatTimeAgo(takenAtDate);
    const tod = formatTimeOfDay(takenAtDate);
    return tod ? `${rel} · ${tod}` : rel;
  }, [takenAtDate]);

  const canUpload = !!category && !!media?.file && !isUploading;

  const handleUpload = async () => {
    if (!canUpload) return;
    try {
      // 답변 모드면 장소는 질문의 장소를 그대로 사용 (placeName), place_id는 link 단계에서 묶음
      const finalLat = editedLoc?.lat ?? media.lat;
      const finalLng = editedLoc?.lng ?? media.lng;
      const finalPlace = isAnswerMode
        ? answerQuestion?.place_name || editedLoc?.placeName || resolvedPlace || media.placeName || null
        : editedLoc?.placeName || resolvedPlace || media.placeName || null;
      const postId = await upload({
        file: media.file,
        category,
        body,
        takenAt: media.takenAt,
        lat: finalLat,
        lng: finalLng,
        placeName: finalPlace,
        source: media.source,
        mode: media.mode,
        accuracy: media.accuracy ?? null,
        exif: media.exif ?? null,
      });
      resetUploadStore();

      if (isAnswerMode && answerTo) {
        // 게시물을 질문에 답변으로 연결 (answer_count 증가 + 알림)
        const { error: linkErr } = await supabase.rpc('link_post_to_question', {
          p_question_id: answerTo,
          p_post_id: postId,
        });
        if (linkErr) logger.warn('link_post_to_question 실패', linkErr?.message || linkErr);
        navigate(`/question/${encodeURIComponent(answerTo)}`, { replace: true });
        return;
      }

      navigate(`/upload/complete/${postId}`, { replace: true });
    } catch (err) {
      // 훅에서 setError 호출되지만, 사용자 화면에 즉시 피드백을 줘서 "왜 업로드 화면으로 돌아왔나" 가 안 보이게.
      const msg = err?.message || '업로드에 실패했어요. 다시 시도해주세요.';
      logger.error('업로드 실패:', err);
      alert(msg);
    }
  };

  // 카카오 Places 키워드 검색 (debounced)
  useEffect(() => {
    if (!locOpen) return undefined;
    const q = String(locQuery || '').trim();
    if (!q) {
      setLocResults([]);
      setLocLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLocLoading(true);
    const timer = setTimeout(async () => {
      try {
        await ensureKakaoMapsServicesReady();
        if (cancelled) return;
        if (!window.kakao?.maps?.services) {
          setLocResults([]);
          return;
        }
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(
          q,
          (data, status) => {
            if (cancelled) return;
            if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data)) {
              setLocResults([]);
            } else {
              setLocResults(data.slice(0, 8));
            }
            setLocLoading(false);
          },
          { size: 10 },
        );
      } catch {
        if (!cancelled) {
          setLocResults([]);
          setLocLoading(false);
        }
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locOpen, locQuery]);

  const selectLocResult = (r) => {
    const lat = parseFloat(r.y);
    const lng = parseFloat(r.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const name = r.place_name || r.address_name || locQuery;
    setEditedLoc({ lat, lng, placeName: name });
    setResolvedPlace(name);
    setLocOpen(false);
    setLocQuery('');
    setLocResults([]);
  };

  // 사용자가 직접 수정 → 그 값. 없으면 현재 좌표 기준 재지오코딩 결과.
  // 셔터 시점에 박힌 media.placeName은 좌표가 흔들렸을 수 있어 좌표가 없는 경우에만 폴백.
  const hasCoords = Number.isFinite(media?.lat) && Number.isFinite(media?.lng);
  const displayPlaceName =
    editedLoc?.placeName || resolvedPlace || (hasCoords ? '' : media?.placeName || '');
  const displayAccuracy = editedLoc ? null : (media?.accuracy ?? null);
  const accuracyLabel = (() => {
    if (!Number.isFinite(displayAccuracy) || displayAccuracy <= 0) return '';
    if (displayAccuracy <= 15) return `정밀 ±${Math.round(displayAccuracy)}m`;
    if (displayAccuracy <= 50) return `±${Math.round(displayAccuracy)}m`;
    if (displayAccuracy <= 80) return `대략 ±${Math.round(displayAccuracy)}m`;
    return `부정확 ±${Math.round(displayAccuracy)}m`;
  })();
  const accuracyIsLoose = Number.isFinite(displayAccuracy) && displayAccuracy > 50;

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
      {/* 헤더 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: '#fff',
          borderBottom: `1px solid ${LJ.borderLight}`,
        }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="뒤로"
              style={{
                width: 32,
                height: 32,
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                color: LJ.textPrimary,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <IconArrowLeft size={20} stroke={1.8} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, color: LJ.textPrimary, lineHeight: 1 }}>
              {isAnswerMode ? '답변 작성' : '정보 입력'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 4px',
              color: canUpload ? LJ.key : LJ.textTertiary,
              fontFamily: LJ.fontStack,
              fontSize: 14,
              fontWeight: 700,
              cursor: canUpload ? 'pointer' : 'not-allowed',
            }}
          >
            {isUploading
              ? (isAnswerMode ? '올리는 중...' : '업로드 중...')
              : (isAnswerMode ? '답변 올리기' : '업로드')}
          </button>
        </div>
      </header>

      {/* 답변 모드 — 질문 배너 (사진 위) */}
      {isAnswerMode && answerQuestion && (
        <div style={{ padding: '14px 18px 0' }}>
          <QuestionBanner question={answerQuestion} />
        </div>
      )}

      {/* 사진/영상 미리보기 */}
      {media?.url && (
        <div style={{ padding: '14px 18px 0' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 280,
              background: LJ.bgSurface,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {media.mode === 'video' ? (
              <video
                src={media.url}
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
              />
            ) : (
              <img
                src={media.url}
                alt="업로드 미리보기"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {/* EXIF */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: 6,
                backdropFilter: 'blur(8px)',
              }}
            >
              <IconShieldCheck size={12} stroke={2} color={LJ.key} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: 1 }}>
                EXIF 자동 인증
              </span>
              {takenLabel && (
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10.5 }}>· {takenLabel}</span>
              )}
            </div>
            {/* GPS — resolvedPlace(카카오 reverse geocode) 우선, 없으면 좌표 */}
            {(resolvedPlace || media.placeName || (media.lat && media.lng)) && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  background: 'rgba(0,0,0,0.7)',
                  borderRadius: 6,
                  backdropFilter: 'blur(8px)',
                  maxWidth: 'calc(100% - 20px)',
                }}
              >
                <IconMapPin size={12} stroke={2} color={LJ.key} />
                <span
                  style={{
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayPlaceName ||
                    (media.lat && media.lng
                      ? `${(editedLoc?.lat ?? media.lat).toFixed(4)}, ${(editedLoc?.lng ?? media.lng).toFixed(4)}`
                      : '')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 위치 편집 */}
      <section style={{ padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconMapPin size={14} stroke={1.8} color={LJ.textSecondary} />
            <span style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>위치</span>
            {accuracyLabel && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: accuracyIsLoose ? '#B45309' : LJ.textTertiary,
                  background: accuracyIsLoose ? '#FFF4D6' : 'transparent',
                  padding: accuracyIsLoose ? '2px 6px' : 0,
                  borderRadius: 4,
                }}
              >
                {accuracyLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={refreshLocation}
              disabled={refreshing}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                color: refreshing ? LJ.textTertiary : LJ.textSecondary,
                fontFamily: LJ.fontStack,
                fontSize: 12,
                fontWeight: 600,
                cursor: refreshing ? 'default' : 'pointer',
              }}
              aria-label="현재 위치 다시 측정"
            >
              {refreshing ? '측정 중…' : '다시 측정'}
            </button>
            <button
              type="button"
              onClick={() => setLocOpen((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                color: LJ.key,
                fontFamily: LJ.fontStack,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {locOpen ? '닫기' : '위치 수정'}
            </button>
          </div>
        </div>
        <div
          style={{
            background: LJ.bgSurface,
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: displayPlaceName ? LJ.textPrimary : LJ.textTertiary,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {refreshing
              ? '위치 측정 중…'
              : geocoding
                ? '근처 장소 찾는 중…'
                : displayPlaceName ||
                  (hasCoords
                    ? '근처에 알아볼 만한 장소가 없어요 — "위치 수정"으로 직접 검색해 주세요'
                    : '위치 정보가 없어요 — "다시 측정" 또는 "위치 수정"')}
          </span>
          {editedLoc && (
            <span
              style={{
                fontSize: 10,
                color: LJ.keyTextDark,
                background: LJ.keyBgLight,
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              직접 입력
            </span>
          )}
        </div>
        {accuracyIsLoose && !editedLoc && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 10.5,
              color: '#B45309',
              lineHeight: 1.45,
            }}
          >
            GPS가 살짝 불안정해요. 야외에서 잠시 후 "다시 측정"을 누르거나, "위치 수정"으로 정확한 장소를 검색해 주세요.
          </p>
        )}

        {locOpen && (
          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              autoFocus
              value={locQuery}
              onChange={(e) => setLocQuery(e.target.value)}
              placeholder="장소 또는 지역 검색 (예: 석촌호수, 성수역, 제주공항)"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#fff',
                border: `1px solid ${LJ.borderLight}`,
                borderRadius: 10,
                fontSize: 13,
                fontFamily: LJ.fontStack,
                color: LJ.textPrimary,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {locQuery.trim() && (
              <div
                style={{
                  marginTop: 6,
                  background: '#fff',
                  border: `1px solid ${LJ.borderLight}`,
                  borderRadius: 10,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {locLoading ? (
                  <div style={{ padding: 12, fontSize: 12, color: LJ.textTertiary }}>검색 중…</div>
                ) : locResults.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: LJ.textTertiary }}>검색 결과가 없어요</div>
                ) : (
                  locResults.map((r) => (
                    <button
                      key={r.id || `${r.x}|${r.y}|${r.place_name}`}
                      type="button"
                      onClick={() => selectLocResult(r)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${LJ.borderLight}`,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontFamily: LJ.fontStack,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>
                        {r.place_name}
                      </div>
                      <div style={{ fontSize: 11, color: LJ.textSecondary, marginTop: 2 }}>
                        {r.road_address_name || r.address_name}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 카테고리 (필수) */}
      <section style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>카테고리 선택</span>
          <span
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: LJ.error,
            }}
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            const Icon = c.Icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 14,
                  background: active ? LJ.keyBgLight : '#fff',
                  border: active ? `1.5px solid ${LJ.key}` : `1px solid ${LJ.borderLight}`,
                  borderRadius: 10,
                  color: active ? LJ.keyTextDark : LJ.textPrimary,
                  fontFamily: LJ.fontStack,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon size={18} stroke={1.8} color={active ? LJ.key : LJ.textSecondary} />
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 한 줄 설명 (선택) */}
      <section style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>
            {isAnswerMode ? '답변 한마디' : '한 줄 설명'}
          </span>
          <span style={{ fontSize: 11, color: LJ.textTertiary }}>선택</span>
        </div>
        <div style={{ position: 'relative' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            placeholder={
              isAnswerMode
                ? '예: 윤중로 끝쪽 100% 만개예요, 사람 적어요'
                : '예: 윤중로 80% 만개, 주말이 절정일 듯'
            }
            style={{
              width: '100%',
              minHeight: 60,
              padding: '12px 14px',
              background: LJ.bgSurface,
              border: `1px solid ${LJ.borderLight}`,
              borderRadius: 10,
              fontFamily: LJ.fontStack,
              fontSize: 13,
              color: LJ.textPrimary,
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 12,
              bottom: 8,
              fontSize: 10,
              color: LJ.textTertiary,
            }}
          >
            {body.length}/{MAX_BODY}
          </span>
        </div>
      </section>

      {/* 하단 안내 */}
      <section style={{ padding: '18px 18px 0' }}>
        {isAnswerMode && answerQuestion ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: LJ.keyBgLight,
              borderRadius: 10,
            }}
          >
            <IconInfoCircle size={16} stroke={1.8} color={LJ.key} />
            <p
              className="m-0"
              style={{
                flex: 1,
                fontSize: 11,
                color: LJ.keyTextDark,
                lineHeight: 1.5,
              }}
            >
              답변하면 {answerQuestion.author_name}님에게 알림이 가고, 도움이 되면 영예를 받아요.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: LJ.keyBgLight,
              borderRadius: 10,
            }}
          >
            <IconClock size={16} stroke={1.8} color={LJ.key} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: LJ.keyTextDark }}>
                48시간 라이브 노출
              </div>
              <div style={{ fontSize: 11, color: LJ.keyTextDark, opacity: 0.85, marginTop: 2 }}>
                지금 누군가 이 정보를 기다리고 있어요
              </div>
            </div>
          </div>
        )}
      </section>

      {error && (
        <section style={{ padding: '12px 18px 0' }}>
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(216,80,80,0.08)',
              border: `1px solid ${LJ.error}`,
              borderRadius: 8,
              color: LJ.error,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              업로드 중 문제가 생겼어요
            </div>
            <div style={{ fontSize: 11, opacity: 0.9, wordBreak: 'break-word' }}>
              {String(error?.message || error || 'unknown error')}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default UploadInfoScreen;
