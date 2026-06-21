import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconShieldCheck,
  IconMapPin,
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
  IconInfoCircle,
  IconPlus,
  IconX,
  IconRotateClockwise2,
} from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import {
  getUploadSnapshot,
  subscribeUploadStore,
  resetUploadStore,
  appendUploadMedias,
  removeUploadMediaAt,
  UPLOAD_MAX_MEDIAS,
} from '../stores/uploadStore';
import { validateGalleryFile } from '../lib/exif/validateGalleryFile';
import { formatTimeAgo, formatTimeOfDay } from '../lib/exif/formatTimeAgo';
import { useUpload } from '../hooks/useUpload';
import { useGeolocation } from '../hooks/useGeolocation';
import { useQuestionBrief } from '../hooks/useQuestionBrief';
import QuestionBanner from '../components/answer/QuestionBanner';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { reverseGeocodeToPlaceDetail, extractRegionFromAddress } from '../utils/locationFromGeocode';
import { searchPlaceWithKakaoFirst, ensureKakaoMapsServicesReady } from '../utils/kakaoPlacesGeocode';
import { patchUploadMedia, patchUploadMediaAt } from '../stores/uploadStore';
import { rotateImageMedia } from '../utils/rotateImageMedia';

const CATEGORIES = [
  { id: 'nature', label: '개화·자연', Icon: IconFlower },
  { id: 'weather', label: '날씨·체감', Icon: IconCloud },
  { id: 'event', label: '이벤트·축제', Icon: IconCalendarEvent },
  { id: 'crowd', label: '혼잡도·대기', Icon: IconUsers },
  { id: 'sunset', label: '노을·야경', Icon: IconMoon },
  { id: 'business', label: '영업·운영', Icon: IconBuildingStore },
];

function UploadInfoScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const answerTo = searchParams.get('answerTo');
  const media = useSyncExternalStore(subscribeUploadStore, getUploadSnapshot, getUploadSnapshot);
  const { isUploading, upload, error } = useUpload();
  const geo = useGeolocation();
  const { question: answerQuestion } = useQuestionBrief(answerTo);
  const isAnswerMode = !!answerTo;

  // 업로드 성공 후엔 media 가 비워져도 카메라로 되돌아가지 않도록 잠근다.
  // (resetUploadStore 로 media=null 이 되면 아래 redirect useEffect 가 /camera 로 덮어쓰는 레이스 방지)
  const uploadCompletedRef = useRef(false);

  const [category, setCategory] = useState(null);
  const [body, setBody] = useState('');
  // 화면에 표시할 장소명. 좌표 변경 시 항상 재지오코딩해 최신값을 보여준다.
  const [resolvedPlace, setResolvedPlace] = useState('');
  // 위 장소의 도시/구/동 라벨 (예: "서울 강남구 역삼동")
  const [resolvedRegion, setResolvedRegion] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  // 사용자가 위치를 직접 편집한 경우의 좌표/장소 (있으면 media 값을 덮어씀)
  const [editedLoc, setEditedLoc] = useState(null); // { lat, lng, placeName, region? } | null
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

  // 좌표가 잡혀 있으면 항상 좌표 기반으로 장소명+지역을 재지오코딩한다.
  // (셔터 시점 media.placeName이 어긋났더라도, 좌표 기준의 정확한 건물명/도로명/지번으로 갱신)
  useEffect(() => {
    if (!Number.isFinite(media?.lat) || !Number.isFinite(media?.lng)) {
      setResolvedPlace('');
      setResolvedRegion('');
      setGeocoding(false);
      return undefined;
    }
    let cancelled = false;
    setGeocoding(true);
    (async () => {
      try {
        const detail = await reverseGeocodeToPlaceDetail(media.lat, media.lng);
        if (cancelled) return;
        setResolvedPlace(detail?.name || '');
        setResolvedRegion(detail?.region || '');
      } catch (_) {
        if (!cancelled) {
          setResolvedPlace('');
          setResolvedRegion('');
        }
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
    if (uploadCompletedRef.current) return; // 업로드 완료 후 reset 으로 media 가 비는 건 정상 — 카메라로 보내지 않음
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

  const mediasArr = Array.isArray(media?.medias) ? media.medias : [];
  const filesArr = mediasArr.map((m) => m?.file).filter(Boolean);
  // 설명은 필수 입력 — 비어 있으면 업로드 불가
  const canUpload = !!category && body.trim().length > 0 && filesArr.length > 0 && !isUploading;

  const [rotatingIdx, setRotatingIdx] = useState(-1);
  const handleRotate = async (index) => {
    const target = mediasArr[index];
    if (!target || target.mode === 'video' || rotatingIdx !== -1) return;
    setRotatingIdx(index);
    const prevUrl = target.url;
    try {
      const rotated = await rotateImageMedia(target, 90);
      patchUploadMediaAt(index, rotated);
      if (prevUrl) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch (_) {}
      }
    } catch (e) {
      logger.warn('사진 회전 실패', e?.message || e);
    } finally {
      setRotatingIdx(-1);
    }
  };

  const handleUpload = async () => {
    if (!canUpload) return;
    try {
      // 답변 모드면 장소는 질문의 장소를 그대로 사용 (placeName), place_id는 link 단계에서 묶음
      const finalLat = editedLoc?.lat ?? media.lat;
      const finalLng = editedLoc?.lng ?? media.lng;
      const finalPlace = isAnswerMode
        ? answerQuestion?.place_name || editedLoc?.placeName || resolvedPlace || media.placeName || null
        : editedLoc?.placeName || resolvedPlace || media.placeName || null;
      // 지역명(예: "칠곡시") — 완료 화면에서 "칠곡시 갤러리안나" 형태로 함께 노출
      const finalRegion =
        (editedLoc && typeof editedLoc.region === 'string' ? editedLoc.region : '') ||
        resolvedRegion ||
        null;
      const postId = await upload({
        files: filesArr,
        category,
        body,
        takenAt: media.takenAt,
        lat: finalLat,
        lng: finalLng,
        placeName: finalPlace,
        region: finalRegion,
        source: media.source,
        mode: media.mode,
        accuracy: media.accuracy ?? null,
        exif: media.exif ?? null,
      });

      // 업로드 성공 — 이후 store 가 비워져도 카메라 redirect 가 끼어들지 못하게 잠근다.
      uploadCompletedRef.current = true;

      // 답변 모드: 질문 상세로 이동
      if (isAnswerMode && answerTo) {
        const { error: linkErr } = await supabase.rpc('link_post_to_question', {
          p_question_id: answerTo,
          p_post_id: postId,
        });
        if (linkErr) logger.warn('link_post_to_question 실패', linkErr?.message || linkErr);
        navigate(`/question/${encodeURIComponent(answerTo)}`, { replace: true });
        // navigate 가 라우트를 바꾸므로 store 초기화는 다음 마운트가 안전 — 여기서 비워둬도 됨
        resetUploadStore();
        return;
      }

      // ⚠️ resetUploadStore() 를 먼저 호출하면 useEffect 가 media 없음 → /camera 로 보내는 redirect 가
      //    setTimeout(60ms) 로 큐에 들어가 우리의 /upload/complete/... navigate 를 덮어쓴다.
      //    그래서 라우트를 먼저 바꾸고, 그 다음에 store 를 비운다.
      navigate(`/upload/complete/${postId}`, { replace: true });
      resetUploadStore();
    } catch (err) {
      // 훅에서 setError 호출되지만, 사용자 화면에 즉시 피드백을 줘서 "왜 업로드 화면으로 돌아왔나" 가 안 보이게.
      const msg = err?.message || '업로드에 실패했어요. 다시 시도해주세요.';
      logger.error('업로드 실패:', err);
      alert(msg);
    }
  };

  // 사진 추가 (갤러리 다중 선택). 인앱 카메라 묶음에는 갤러리 추가 금지 (현장성 보존)
  const addInputRef = useRef(null);
  const remainingSlots = Math.max(0, UPLOAD_MAX_MEDIAS - mediasArr.length);
  const canAddMore = remainingSlots > 0 && media?.source !== 'camera' && media?.mode !== 'video';

  const handleAddFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    const sliced = picked.slice(0, remainingSlots);
    const validations = await Promise.all(sliced.map((f) => validateGalleryFile(f)));
    const firstFail = validations.findIndex((v) => !v.valid);
    if (firstFail !== -1) {
      const v = validations[firstFail];
      alert(
        v.reason === 'too_old'
          ? '추가한 사진 중 24시간이 지난 것이 있어요.'
          : 'EXIF 가 없는 사진은 추가할 수 없어요.',
      );
      return;
    }

    const newMedias = sliced.map((f, i) => {
      const v = validations[i];
      const url = URL.createObjectURL(f);
      return {
        file: f,
        url,
        source: 'gallery',
        mode: f.type?.startsWith('video') ? 'video' : 'photo',
        mimeType: f.type,
        size: f.size,
        takenAt: (v.takenAt || new Date()).toISOString(),
        lat: v.location?.lat ?? null,
        lng: v.location?.lng ?? null,
        accuracy: null,
        placeName: null,
        facingMode: null,
        exif: v.exif || null,
      };
    });
    appendUploadMedias(newMedias);
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
    // 카카오 Places 결과의 address_name 에서 도시/구를 추출
    const region = extractRegionFromAddress(r.road_address_name || r.address_name || '');
    setEditedLoc({ lat, lng, placeName: name, region });
    setResolvedPlace(name);
    setResolvedRegion(region);
    setLocOpen(false);
    setLocQuery('');
    setLocResults([]);
  };

  // 사용자가 검색 결과에서 고르지 않고 자기가 친 이름을 그대로 쓰고 싶을 때.
  // 현재 좌표(있으면)를 유지한 채 placeName만 사용자가 친 텍스트로 덮어쓴다.
  // 좌표가 있으면 그 좌표 기준의 도시 라벨을 보강해서 함께 표시.
  const useTypedLocationAsName = async () => {
    const text = String(locQuery || '').trim();
    if (!text) return;
    const lat = editedLoc?.lat ?? media?.lat ?? null;
    const lng = editedLoc?.lng ?? media?.lng ?? null;
    let region = extractRegionFromAddress(text);
    if (!region && Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        const detail = await reverseGeocodeToPlaceDetail(lat, lng);
        if (detail?.region) region = detail.region;
      } catch (_) { /* ignore */ }
    }
    setEditedLoc({
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      placeName: text,
      region,
    });
    setResolvedPlace(text);
    setResolvedRegion(region);
    setLocOpen(false);
    setLocQuery('');
    setLocResults([]);
  };

  // 사용자가 직접 수정 → 그 값. 없으면 현재 좌표 기준 재지오코딩 결과.
  // 셔터 시점에 박힌 media.placeName은 좌표가 흔들렸을 수 있어 좌표가 없는 경우에만 폴백.
  const hasCoords = Number.isFinite(media?.lat) && Number.isFinite(media?.lng);
  const displayPlaceName =
    editedLoc?.placeName || resolvedPlace || (hasCoords ? '' : media?.placeName || '');
  const displayRegion =
    (editedLoc && typeof editedLoc.region === 'string' ? editedLoc.region : '') ||
    resolvedRegion ||
    '';
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
            position: 'relative',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
            <IconArrowLeft size={18} stroke={1.8} />
          </button>
          <span
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 16,
              fontWeight: 600,
              color: LJ.textPrimary,
              lineHeight: 1,
            }}
          >
            {isAnswerMode ? '답변 작성' : '정보 입력'}
          </span>
        </div>
      </header>

      {/* 답변 모드 — 질문 배너 (사진 위) */}
      {isAnswerMode && answerQuestion && (
        <div style={{ padding: '14px 18px 0' }}>
          <QuestionBanner question={answerQuestion} />
        </div>
      )}

      {/* 사진/영상 미리보기 — 대표 영역에서 좌우 스와이프로 전체 미리보기 */}
      {mediasArr.length > 0 && (
        <div style={{ padding: '14px 18px 0' }}>
          <UploadPreviewSlider
            medias={mediasArr}
            displayPlaceName={displayPlaceName}
            editedLocLat={editedLoc?.lat ?? null}
            editedLocLng={editedLoc?.lng ?? null}
            firstTakenLabel={takenLabel}
            onRotate={handleRotate}
            rotatingIdx={rotatingIdx}
          />

          {/* 썸네일 스트립 + 추가 버튼 */}
          {(mediasArr.length > 1 || canAddMore) && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 2,
                touchAction: 'pan-x',
              }}
              className="hide-scrollbar"
            >
              {mediasArr.map((m, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 64,
                    flex: '0 0 auto',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: LJ.bgSurface,
                    border: i === 0 ? `1.5px solid ${LJ.key}` : `1px solid ${LJ.borderLight}`,
                  }}
                >
                  {m?.mode === 'video' ? (
                    <video
                      src={m.url}
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <img
                      src={m?.url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  {mediasArr.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUploadMediaAt(i)}
                      aria-label="사진 삭제"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconX size={11} stroke={2.5} />
                    </button>
                  )}
                </div>
              ))}
              {canAddMore && (
                <>
                  <button
                    type="button"
                    onClick={() => addInputRef.current?.click()}
                    aria-label="사진 추가"
                    style={{
                      width: 64,
                      height: 64,
                      flex: '0 0 auto',
                      borderRadius: 8,
                      background: '#fff',
                      border: `1.5px dashed ${LJ.key}`,
                      cursor: 'pointer',
                      color: LJ.key,
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      padding: 0,
                    }}
                  >
                    <IconPlus size={18} stroke={2} />
                    <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
                      {remainingSlots}장
                    </span>
                  </button>
                  <input
                    ref={addInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleAddFiles}
                  />
                </>
              )}
            </div>
          )}
          {media?.source === 'camera' && mediasArr.length === 1 && (
            <p style={{ margin: '8px 0 0', fontSize: 10.5, color: LJ.textTertiary, lineHeight: 1.5 }}>
              인앱 카메라로 찍은 사진에는 갤러리 사진을 섞을 수 없어요 (지금 현장 인증 보존)
            </p>
          )}
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
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: displayPlaceName ? LJ.textPrimary : LJ.textTertiary,
                lineHeight: 1.35,
                wordBreak: 'keep-all',
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
            </div>
            {displayRegion && (
              <div
                style={{
                  marginTop: 3,
                  fontSize: 11.5,
                  color: LJ.textSecondary,
                  lineHeight: 1.35,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconMapPin size={11} stroke={1.8} color={LJ.textTertiary} />
                <span>{displayRegion}</span>
              </div>
            )}
          </div>
          {editedLoc && (
            <span
              style={{
                fontSize: 10,
                color: LJ.keyTextDark,
                background: LJ.keyBgLight,
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
                flexShrink: 0,
                marginTop: 2,
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
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                autoFocus
                value={locQuery}
                onChange={(e) => setLocQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    useTypedLocationAsName();
                  }
                }}
                placeholder="장소를 검색하거나 직접 입력 (예: 석촌호수, 성수역)"
                style={{
                  flex: 1,
                  minWidth: 0,
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
              <button
                type="button"
                onClick={useTypedLocationAsName}
                disabled={!locQuery.trim()}
                style={{
                  padding: '0 12px',
                  background: locQuery.trim() ? LJ.key : LJ.borderLight,
                  color: locQuery.trim() ? '#fff' : LJ.textTertiary,
                  border: 'none',
                  borderRadius: 10,
                  fontFamily: LJ.fontStack,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: locQuery.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                이 이름 사용
              </button>
            </div>
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

      {/* 설명 (필수) — 화면의 중심. 큼직하게. */}
      <section style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>
            {isAnswerMode ? '답변 한마디' : '설명'}
          </span>
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
        <div style={{ position: 'relative' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              isAnswerMode
                ? '예: 윤중로 끝쪽 100% 만개예요, 사람 적어요'
                : '예: 윤중로 80% 만개, 주말이 절정일 듯'
            }
            style={{
              width: '100%',
              minHeight: 150,
              padding: '14px 16px',
              background: LJ.bgSurface,
              border: `1px solid ${LJ.borderLight}`,
              borderRadius: 12,
              fontFamily: LJ.fontStack,
              fontSize: 14,
              color: LJ.textPrimary,
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </section>

      {/* 카테고리 (필수) — 설명 아래. 버튼은 가볍게. */}
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
            gap: 7,
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
                  gap: 7,
                  minHeight: 0,
                  padding: '9px 12px',
                  background: active ? LJ.keyBgLight : '#fff',
                  border: active ? `1.5px solid ${LJ.key}` : `1px solid ${LJ.borderLight}`,
                  borderRadius: 9,
                  color: active ? LJ.keyTextDark : LJ.textSecondary,
                  fontFamily: LJ.fontStack,
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon size={16} stroke={1.8} color={active ? LJ.key : LJ.textTertiary} />
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 답변 모드 안내 */}
      {isAnswerMode && answerQuestion && (
        <section style={{ padding: '18px 18px 0' }}>
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
        </section>
      )}

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

      {/* 업로드 버튼 — 화면 하단 고정 */}
      <div style={{ padding: '16px 18px 0' }}>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!canUpload}
          style={{
            width: '100%',
            padding: 15,
            background: canUpload ? LJ.key : LJ.bgSurface,
            color: canUpload ? '#fff' : LJ.textTertiary,
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 15,
            fontWeight: 700,
            cursor: canUpload ? 'pointer' : 'not-allowed',
          }}
        >
          {isUploading
            ? (isAnswerMode ? '올리는 중...' : '업로드 중...')
            : (isAnswerMode ? '답변 올리기' : '업로드')}
        </button>
      </div>
    </div>
  );
}

/**
 * 업로드 정보화면 대표 미리보기 슬라이더.
 * - 선택한 사진/영상 전체를 좌우 스와이프로 미리볼 수 있음
 * - 한 번의 스와이프 = 1장 이동, PointerEvents 기반
 */
function UploadPreviewSlider({ medias, displayPlaceName, editedLocLat, editedLocLng, firstTakenLabel, onRotate, rotatingIdx = -1 }) {
  const [idx, setIdx] = React.useState(0);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const lockedAxisRef = React.useRef(null);
  const activePointerIdRef = React.useRef(null);

  const SWIPE_COMMIT_PX = 40;
  const N = medias.length;

  // 미디어 수가 바뀌면 인덱스 보정
  React.useEffect(() => {
    if (idx >= N) setIdx(Math.max(0, N - 1));
  }, [N, idx]);

  const current = medias[idx] || medias[0];

  const formatLabel = (m) => {
    if (!m?.takenAt) return '';
    try {
      return formatTimeAgo(new Date(m.takenAt));
    } catch {
      return '';
    }
  };

  const itemTakenLabel = idx === 0 ? firstTakenLabel : formatLabel(current);

  const onPointerDown = (e) => {
    if (N <= 1) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lockedAxisRef.current = null;
    setIsDragging(true);
    setDragOffset(0);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!isDragging || activePointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (lockedAxisRef.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    if (lockedAxisRef.current !== 'x') return;
    if (e.cancelable) e.preventDefault();
    let dragX = dx;
    if ((idx === 0 && dx > 0) || (idx === N - 1 && dx < 0)) {
      dragX = dx * 0.35;
    }
    setDragOffset(dragX);
  };

  const finishDrag = (e) => {
    if (!isDragging) return;
    if (activePointerIdRef.current != null && activePointerIdRef.current !== e?.pointerId) return;
    const dx = dragOffset;
    setIsDragging(false);
    setDragOffset(0);
    activePointerIdRef.current = null;
    if (lockedAxisRef.current === 'x' && Math.abs(dx) >= SWIPE_COMMIT_PX) {
      setIdx((prev) => Math.max(0, Math.min(N - 1, prev + (dx < 0 ? 1 : -1))));
    }
    lockedAxisRef.current = null;
    try {
      if (e?.pointerId != null) e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  return (
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
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          touchAction: 'pan-y',
          transform: `translate3d(calc(${-idx * 100}% + ${dragOffset}px), 0, 0)`,
          transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.22, 0.7, 0.2, 1)',
          cursor: N > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          willChange: 'transform',
        }}
      >
        {medias.map((m, i) => (
          <div
            key={`${m.url}-${i}`}
            style={{
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              background: '#000',
            }}
          >
            {m.mode === 'video' ? (
              <video
                src={m.url}
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: 'block' }}
              />
            ) : (
              <img
                src={m.url}
                alt={`업로드 미리보기 ${i + 1}`}
                draggable="false"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        ))}
      </div>

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
          pointerEvents: 'none',
        }}
      >
        <IconShieldCheck size={12} stroke={2} color={LJ.key} />
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: 1 }}>
          EXIF 자동 인증
        </span>
        {itemTakenLabel && (
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10.5 }}>· {itemTakenLabel}</span>
        )}
      </div>

      {/* N / M */}
      {N > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '4px 9px',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 6,
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {idx + 1} / {N}
        </div>
      )}

      {/* GPS — 첫 미디어 기준 좌표/장소 */}
      {(displayPlaceName ||
        (Number.isFinite(editedLocLat) && Number.isFinite(editedLocLng)) ||
        (current?.lat != null && current?.lng != null)) && (
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
            pointerEvents: 'none',
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
              (current?.lat != null && current?.lng != null
                ? `${Number(editedLocLat ?? current.lat).toFixed(4)}, ${Number(editedLocLng ?? current.lng).toFixed(4)}`
                : '')}
          </span>
        </div>
      )}

      {/* 회전 버튼 — 가로로 찍혀 누운 사진을 정면으로 돌리기 (이미지에만) */}
      {current?.mode !== 'video' && typeof onRotate === 'function' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRotate(idx);
          }}
          disabled={rotatingIdx === idx}
          aria-label="사진 90도 회전"
          style={{
            position: 'absolute',
            top: 10,
            right: N > 1 ? 56 : 10,
            width: 34,
            height: 34,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.7)',
            border: 'none',
            color: '#fff',
            cursor: rotatingIdx === idx ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            opacity: rotatingIdx === idx ? 0.6 : 1,
            zIndex: 4,
          }}
        >
          <IconRotateClockwise2 size={18} stroke={2} />
        </button>
      )}

      {/* 페이지 점 인디케이터 (5장 이하) */}
      {N > 1 && N <= 5 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {medias.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                borderRadius: 999,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 160ms ease-out',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadInfoScreen;
