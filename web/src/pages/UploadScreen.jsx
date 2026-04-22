import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useMatch } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { uploadImage, uploadVideo, getDisplayImageUrl } from '../api/upload';
import { useAuth } from '../contexts/AuthContext';
import { notifyBadge } from '../utils/notifications';
import { checkNewBadges, awardBadge, calculateUserStats } from '../utils/badgeSystem';
import { analyzeImageForTags } from '../utils/aiImageAnalyzer';
import { getWeatherByRegion } from '../api/weather';
import { createPostSupabase, fetchPostByIdSupabase, updatePostSupabase, fetchPostsByUserIdSupabase } from '../api/postsSupabase';
import { getCurrentTimestamp, getTimeAgo } from '../utils/timeUtils';
import { getBadgeCongratulationMessage, getBadgeDifficultyEffects } from '../utils/badgeMessages';
import { logger } from '../utils/logger';
import { extractExifData, convertGpsToAddress, formatExifDate, isExifCaptureTooOldForUpload } from '../utils/exifExtractor';
import { slugsFromAnalysisResult } from '../utils/travelCategories';
import { normalizeRegionName } from '../utils/regionNames';
import { searchPlaceWithKakaoFirst } from '../utils/kakaoPlacesGeocode';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import StatusBadge from '../components/StatusBadge';
import { usePhotoValidation } from '../hooks/usePhotoValidation';
import { useExifConsent } from '../contexts/ExifConsentContext';

// 업로드 가이드는 별도 화면(`/upload/guide`)에서만 노출

/** 지역 + 세부 장소 → "대구 송해공원" 한 줄 */
function combineLocationParts(region, place) {
  const r = String(region || '').trim();
  const p = String(place || '').trim();
  if (!r && !p) return '';
  if (!r) return p;
  if (!p) return r;
  return `${r} ${p}`;
}

/** 기존 한 줄 주소·장소명 → 입력 폼용 분리 (첫 토큰 = 지역) */
function splitLocationForForm(full) {
  const s = String(full || '');
  const trimmed = s.trim();
  if (!trimmed) return { region: '', place: '' };
  const leadTrim = s.replace(/^\s+/, '');
  const m = leadTrim.match(/^(\S+)(?:\s+(.*))?$/);
  if (!m) return { region: trimmed, place: '' };
  return { region: m[1] || '', place: m[2] || '' };
}

const UploadScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editMatch = useMatch({ path: '/post/:id/edit', end: true });
  const editingPostId = editMatch?.params?.id ?? null;
  const { user } = useAuth();
  const { exifAllowed } = useExifConsent();
  const { handleDragStart } = useHorizontalDragScroll();
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [cameraPreviewStream, setCameraPreviewStream] = useState(null);
  const cameraVideoRef = useRef(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment'); // 'environment' | 'user'
  const [cameraTorchOn, setCameraTorchOn] = useState(false);
  const [cameraTorchSupported, setCameraTorchSupported] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // 업로드 가이드는 별도 화면(`/upload/guide`)만 유지하고,
  // 업로드 화면에서는 팝업/강제 이동을 하지 않는다.
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [formData, setFormData] = useState({
    images: [],
    imageFiles: [],
    videos: [],
    videoFiles: [],
    /** 위치 입력(원문) — 공백 포함해 입력 UX 유지 */
    locationLine: '',
    locationRegion: '',
    locationPlace: '',
    tags: [],
    note: '',
    coordinates: null,
    aiCategory: 'scenic',
    aiCategories: ['scenic'],
    aiCategoryName: '추천장소',
    aiCategoryIcon: '🏞️',
    exifData: null, // EXIF 데이터 (날짜, GPS 등)
    exifForFileKey: null, // exifData가 대응하는 첫 이미지 파일 식별자
    photoDate: null, // 사진 촬영 날짜
    verifiedLocation: null, // EXIF에서 추출한 검증된 위치
    /** 편집 모드: 서버에 저장된 앱 내 촬영 여부(로컬 파일 없을 때 배지용) */
    savedInAppCamera: null,
  });

  const combinedLocation = useMemo(
    () => combineLocationParts(formData.locationRegion, formData.locationPlace),
    [formData.locationRegion, formData.locationPlace]
  );

  // EXIF 자동 입력/편집 모드 등으로 region/place가 바뀌면 입력 원문도 동기화
  useEffect(() => {
    const next = combinedLocation;
    setFormData((prev) => {
      const cur = String(prev.locationLine || '');
      // 사용자가 이미 직접 입력 중이면(원문이 있고, 합친 값이 포함) 덮어쓰지 않음
      if (cur && cur.replace(/\s+/g, ' ').trim() && cur.replace(/\s+/g, ' ').trim() !== next) return prev;
      if (cur === next) return prev;
      return { ...prev, locationLine: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedLocation]);

  /** 라이브저니 웹 카메라로 찍은 파일명(capture-타임스탬프.jpg) — 첫 장만 배지에 사용 */
  const isInAppCamera = useMemo(() => {
    const f = formData.imageFiles?.[0];
    if (!f || String(f.type || '').startsWith('video/')) {
      return editingPostId && formData.savedInAppCamera === true;
    }
    const name = f.name || '';
    return /^capture-\d+\.(jpe?g|webp)$/i.test(name);
  }, [formData.imageFiles, formData.savedInAppCamera, editingPostId]);

  const [exifExtracting, setExifExtracting] = useState(false);
  const [exifGeoResolving, setExifGeoResolving] = useState(false);
  const locNoteRef = useRef({ location: '', note: '' });
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [autoTags, setAutoTags] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const weatherTagWhitelist = new Set([
    '맑음', '맑은날씨', '청명한날씨', '화창한날씨', '쾌청한날씨',
    '흐림', '흐린날씨', '구름많음', '구름조금',
    '비', '소나기', '장마', '강수', '우천', '우천주의',
    '눈', '강설', '눈발', '함박눈', '소낙눈',
    '바람', '강풍', '미풍', '시원한바람', '따뜻한바람',
    '안개', '짙은안개', '옅은안개',
    '습도', '건조', '습함', '쾌적한습도',
    '체감온도', '체감온도낮음', '체감온도높음', '쾌적한온도',
    '일출', '일몰', '황금시간대', '블루아워', '골든아워',
    '자외선', '자외선강함', '자외선주의', '자외선약함',
    '봄날씨', '여름날씨', '가을날씨', '겨울날씨'
  ]);

  const normalizeTag = (tag) => (tag || '').replace('#', '').trim();

  useEffect(() => {
    locNoteRef.current = { location: combinedLocation, note: formData.note };
  });

  const firstImageFile = formData.imageFiles?.[0] ?? null;
  const firstImageFileKey = useMemo(
    () =>
      firstImageFile
        ? `${firstImageFile.name}:${firstImageFile.size}:${firstImageFile.lastModified}`
        : '',
    [firstImageFile]
  );

  const prefetchedExifForValidation = useMemo(() => {
    if (!firstImageFile || !exifAllowed) return null;
    return {
      fileKey: firstImageFileKey,
      exif: formData.exifForFileKey === firstImageFileKey ? formData.exifData : null,
    };
  }, [firstImageFile, firstImageFileKey, exifAllowed, formData.exifForFileKey, formData.exifData]);

  const { status: photoStatus, loading: validatingPhoto } = usePhotoValidation({
    file: firstImageFile,
    isInAppCamera,
    exifAllowed,
    exifExtracting,
    prefetchedExif: prefetchedExifForValidation,
    serverPhotoDateIso: editingPostId ? formData.photoDate || null : null,
  });

  const isExifCaptureBlocked = useMemo(() => {
    if (isInAppCamera) return false;
    const first = formData.imageFiles[0];
    if (!first || first.type.startsWith('video/')) return false;
    if (!exifAllowed) return false;
    if (exifExtracting) return false;
    return isExifCaptureTooOldForUpload(formData.photoDate, {
      isInAppCamera,
      hasOnlyVideo: formData.images.length === 0 && formData.videos.length > 0,
    });
  }, [
    isInAppCamera,
    formData.imageFiles,
    formData.images.length,
    formData.videos.length,
    formData.photoDate,
    exifAllowed,
    exifExtracting,
  ]);

  // "#태그1 #태그2" / "#태그1#태그2" / "태그1, 태그2" 등 입력을 개별 태그로 분리
  const parseTagsFromInput = (text) => {
    const raw = String(text || '').trim();
    if (!raw) return [];

    // #로 시작하는 토큰이 하나라도 있으면 해시태그 패턴을 우선 사용
    const hashMatches = raw.match(/#[^\s#]+/g);
    if (hashMatches && hashMatches.length > 0) {
      return hashMatches.map((t) => normalizeTag(t)).filter(Boolean);
    }

    return raw
      .split(/[\s,]+/g)
      .map((t) => normalizeTag(t))
      .filter(Boolean);
  };

  const dedupeHashtags = (tags) => {
    const map = new Map();
    (tags || []).forEach((tag) => {
      const cleaned = normalizeTag(tag);
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!map.has(key)) {
        map.set(key, `#${cleaned}`);
      }
    });
    return Array.from(map.values());
  };

  const isWeatherTag = (tag) => {
    const cleaned = normalizeTag(tag);
    if (!cleaned) return false;
    if (weatherTagWhitelist.has(cleaned)) return true;
    if (cleaned.includes('날씨')) return true;
    if (cleaned.includes('구름') || cleaned.includes('비') || cleaned.includes('눈')) return true;
    return false;
  };

  const buildWeatherTagsFromCondition = (condition, temperatureText = '') => {
    const tags = [];
    const tempValue = parseInt(temperatureText.replace('℃', ''), 10);
    const normalized = (condition || '').trim();

    if (!normalized) return tags;

    if (normalized.includes('맑음')) {
      tags.push('맑음', '맑은날씨', '청명한날씨');
    } else if (normalized.includes('구름')) {
      tags.push('구름많음', '흐림');
    } else if (normalized.includes('흐림')) {
      tags.push('흐림', '흐린날씨');
    } else if (normalized.includes('비')) {
      tags.push('비', '우천', '강수');
    } else if (normalized.includes('눈')) {
      tags.push('눈', '강설');
    } else if (normalized.includes('안개')) {
      tags.push('안개', '옅은안개');
    }

    if (!Number.isNaN(tempValue)) {
      if (tempValue >= 30) {
        tags.push('체감온도높음', '자외선주의');
      } else if (tempValue <= 0) {
        tags.push('체감온도낮음');
      }
    }

    return tags;
  };
  const buildMoodTags = (analysisResult, noteText = '') => {
    const text = `${analysisResult?.caption || ''} ${(analysisResult?.tags || []).join(' ')} ${noteText || ''}`.toLowerCase();
    const color = analysisResult?.colorAnalysis || analysisResult?.metadata?.colorAnalysis || null;

    const moodCandidates = [
      { match: /야경|밤|night|dark|블루아워|골든아워|일몰|노을/, tags: ['야경 감성', '로맨틱'] },
      { match: /바다|해변|파도|윤슬|오션|sea|beach/, tags: ['청량', '시원한 바람'] },
      { match: /벚꽃|꽃|개화|만개|절정|spring/, tags: ['화사함', '봄 감성'] },
      { match: /산|숲|트레킹|등산|오름|hiking|forest/, tags: ['힐링', '초록 무드'] },
      { match: /카페|커피|cafe|coffee|브런치/, tags: ['감성', '여유'] },
      { match: /시장|맛집|음식|food|국밥|면|고기|횟집/, tags: ['로컬', '맛있는 하루'] },
    ];

    for (const c of moodCandidates) {
      if (c.match.test(text)) return c.tags;
    }

    // 색상 기반 fallback
    if (color?.isDark) return ['차분함', '감성'];
    if (color?.isBright) return ['맑은 기분', '산뜻함'];
    return ['여유', '기분 전환'];
  };

  const pickTwo = (items) => {
    const out = [];
    const seen = new Set();
    (items || []).forEach((v) => {
      const s = normalizeTag(String(v || ''));
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return;
      seen.add(key);
      out.push(s);
    });
    return out.slice(0, 2);
  };

  const formatHash = (s) => {
    const clean = normalizeTag(s);
    return clean ? `#${clean}` : '';
  };
  const [loadingAITags, setLoadingAITags] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [earnedBadge, setEarnedBadge] = useState(null);
  const [badgeAnimationKey, setBadgeAnimationKey] = useState(0);
  const setBadgeAnimationKeyRef = useRef(setBadgeAnimationKey);
  setBadgeAnimationKeyRef.current = setBadgeAnimationKey;
  const [editFormReady, setEditFormReady] = useState(!editingPostId);
  const weatherCacheRef = useRef(new Map()); // regionName -> weather

  const getWeatherCached = useCallback(async (regionName) => {
    const key = String(regionName || '').trim();
    if (!key) return null;
    const cached = weatherCacheRef.current.get(key);
    if (cached) return cached;
    try {
      const res = await getWeatherByRegion(key);
      const weather = res?.success && res.weather ? res.weather : null;
      if (weather) weatherCacheRef.current.set(key, weather);
      return weather;
    } catch {
      return null;
    }
  }, []);

  const lastEditRouteIdRef = useRef(null);

  useEffect(() => {
    if (!editingPostId) {
      setEditFormReady(true);
      lastEditRouteIdRef.current = null;
      return;
    }
    if (lastEditRouteIdRef.current === editingPostId) return;
    lastEditRouteIdRef.current = editingPostId;
    setEditFormReady(false);
    setShowUploadGuide(false);

    let cancelled = false;
    (async () => {
      const idStr = String(editingPostId).trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
      let post = null;
      if (isUuid) {
        try {
          post = await fetchPostByIdSupabase(idStr);
        } catch (_) {}
      }
      if (cancelled || !post) {
        if (!cancelled) navigate('/main', { replace: true });
        return;
      }
      const imgs = Array.isArray(post.images) ? post.images : post.image ? [post.image] : [];
      const vids = Array.isArray(post.videos) ? post.videos : [];
      const locRaw = post.location || post.detailedLocation || post.placeName || '';
      const loc = typeof locRaw === 'string' ? locRaw : locRaw?.name || '';
      const locParts = splitLocationForForm(loc);
      const note = post.note || post.content || '';
      const tagList = Array.isArray(post.tags) ? post.tags : [];
      const tagsNormalized = dedupeHashtags(
        tagList.flatMap((t) => {
          const s = typeof t === 'string' ? t : String(t?.name ?? t?.label ?? '');
          const parsed = parseTagsFromInput(s);
          return parsed.map((p) => `#${p}`);
        })
      );

      setFormData((prev) => ({
        ...prev,
        images: imgs.map((u) => getDisplayImageUrl(u)),
        videos: vids.map((u) => getDisplayImageUrl(u)),
        imageFiles: [],
        videoFiles: [],
        locationRegion: locParts.region,
        locationPlace: locParts.place,
        tags: tagsNormalized.length ? tagsNormalized : prev.tags,
        note,
        coordinates: post.coordinates || prev.coordinates,
        aiCategory: post.category || prev.aiCategory,
        aiCategories:
          Array.isArray(post.categories) && post.categories.length > 0
            ? post.categories
            : [post.category || prev.aiCategory || 'scenic'],
        aiCategoryName: post.categoryName || prev.aiCategoryName,
        aiCategoryIcon: post.categoryIcon || prev.aiCategoryIcon,
        photoDate: post.photoDate || post.exifData?.photoDate || null,
        verifiedLocation: post.verifiedLocation || null,
        exifData: post.exifData || null,
        exifForFileKey: null,
        savedInAppCamera: post.isInAppCamera === true,
      }));
      setAutoTags([]);
      setEditFormReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [editingPostId, navigate]);

  // 업로드 화면에서는 가이드 팝업을 절대 띄우지 않음
  useEffect(() => {
    setShowUploadGuide(false);
  }, []);

  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) return;

    setLoadingLocation(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;

      if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
        const geocoder = new window.kakao.maps.services.Geocoder();

        geocoder.coord2Address(longitude, latitude, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result[0]) {
            const address = result[0].address;
            const roadAddress = result[0].road_address;

            let locationName = '';
            let detailedAddress = '';

            if (roadAddress) {
              const parts = roadAddress.address_name.split(' ');
              // 시까지만 노출되도록, 첫 번째(도/광역시)는 제거하고 다음 2개만 사용
              locationName = parts.slice(1, 3).join(' ')
                .replace('특별시', '')
                .replace('광역시', '')
                .replace('특별자치시', '')
                .replace('특별자치도', '')
                .trim();
              detailedAddress = roadAddress.address_name;
            } else {
              const parts = address.address_name.split(' ');
              locationName = parts.slice(1, 3).join(' ')
                .replace('특별시', '')
                .replace('광역시', '')
                .replace('특별자치시', '')
                .replace('특별자치도', '')
                .trim();
              detailedAddress = address.address_name;
            }

            const lp = splitLocationForForm(locationName);
            setFormData(prev => ({
              ...prev,
              locationRegion: lp.region,
              locationPlace: lp.place,
              coordinates: { lat: latitude, lng: longitude },
              address: detailedAddress,
              detailedLocation: locationName
            }));
            setLoadingLocation(false);
          } else {
            setFormData(prev => ({
              ...prev,
              locationRegion: '서울',
              locationPlace: '',
              coordinates: { lat: latitude, lng: longitude }
            }));
            setLoadingLocation(false);
          }
        });
      } else {
        setFormData(prev => ({
          ...prev,
          locationRegion: '서울',
          locationPlace: '',
          coordinates: { lat: latitude, lng: longitude }
        }));
        setLoadingLocation(false);
      }
    } catch (error) {
      logger.error('위치 감지 실패:', error);
      setLoadingLocation(false);
    }
  }, []);

  const analyzeImageAndGenerateTags = useCallback(async (file, location = '', note = '', precomputedExif = undefined) => {
    // 사진 파일이 없으면 분석하지 않음
    if (!file) {
      setAutoTags([]);
      return;
    }

    setLoadingAITags(true);
    try {
      const analysisResult = await analyzeImageForTags(file, location, note, precomputedExif);
      const regionName = location?.split(' ')[0] || location || '';
      let weatherTags = [];

      if (regionName) {
        try {
          const weather = await getWeatherCached(regionName);
          if (weather) {
            weatherTags = buildWeatherTagsFromCondition(
              weather.condition,
              weather.temperature
            );
          }
        } catch (weatherError) {
          logger.warn('날씨 태그 생성 실패 (무시):', weatherError);
        }
      }

      const hasTags = analysisResult.tags && analysisResult.tags.length > 0;
      const hasCategory = analysisResult.category && analysisResult.categoryName;

      if (analysisResult.success || hasCategory || hasTags) {
        // 추천 태그 구성: 날씨 2 + 분위기 2 + 사진분석 2 (총 6개)
        const limitedTags = (analysisResult.tags || []).slice(0, 24);

        const existingTags = formData.tags.map((tag) =>
          tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase()
        );

        /** AI·분석 결과 태그: 날씨만 허용하지 않고, 의미 있는 문자열이면 채택 */
        const filteredTags = limitedTags
          .filter((tag) => {
            const tagWithoutHash = tag.startsWith('#') ? tag.substring(1) : String(tag);
            const trimmed = tagWithoutHash.trim();
            if (!trimmed) return false;
            const tagLower = trimmed.toLowerCase();
            if (existingTags.includes(tagLower)) return false;
            if (trimmed.length > 40) return false;
            return /^[a-zA-Z0-9가-힣\s\-_]+$/.test(trimmed);
          })
          .slice(0, 8);

        const weatherPick = pickTwo(weatherTags).map(formatHash).filter(Boolean); // 정확히 0~2

        const moodPick = pickTwo(buildMoodTags(analysisResult, note))
          .map(formatHash)
          .filter(Boolean);

        // 사진분석(analysis) 태그 2개: AI 결과 중에서 날씨/분위기 제외하고 선별
        const moodLower = new Set(moodPick.map((t) => normalizeTag(t).toLowerCase()));
        const analysisPick = pickTwo(
          filteredTags
            .map((tag) => String(tag || '').trim())
            .filter(Boolean)
            .filter((t) => !isWeatherTag(t))
            .filter((t) => !moodLower.has(normalizeTag(t).toLowerCase()))
        )
          .map(formatHash)
          .filter(Boolean);

        // 테마 이름이 태그로 직접 노출되는 것은 제거 (요청)
        const THEME_TAG_BLOCKLIST = new Set([
          '지금이절정',
          '한적한아지트',
          '딥씨블루',
          '힙활기',
          '안심나들이',
        ].map((t) => normalizeTag(t).toLowerCase()));

        const final = dedupeHashtags(
          [
            ...weatherPick,
            ...moodPick,
            ...analysisPick,
          ].filter((t) => {
            const cleaned = normalizeTag(String(t || '')).toLowerCase();
            return cleaned && !THEME_TAG_BLOCKLIST.has(cleaned);
          })
        );

        // 부족하면 남는 AI 태그로 채우기(최대 6)
        if (final.length < 6) {
          const extras = filteredTags
            .map((t) => formatHash(t))
            .filter(Boolean)
            .filter((t) => !final.some((x) => normalizeTag(x).toLowerCase() === normalizeTag(t).toLowerCase()))
            .filter((t) => !isWeatherTag(t))
            .filter((t) => {
              const cleaned = normalizeTag(t).toLowerCase();
              return cleaned && !THEME_TAG_BLOCKLIST.has(cleaned);
            });
          setAutoTags(dedupeHashtags([...final, ...extras]).slice(0, 6));
        } else {
          setAutoTags(final.slice(0, 6));
        }
        const slugList = slugsFromAnalysisResult(analysisResult);
        setFormData(prev => ({
          ...prev,
          aiCategories: slugList,
          aiCategory: slugList[0] ?? analysisResult.category ?? prev.aiCategory ?? 'scenic',
          aiCategoryName: analysisResult.categoryName ?? prev.aiCategoryName ?? '추천장소',
          aiCategoryIcon: analysisResult.categoryIcon ?? prev.aiCategoryIcon ?? '🏞️'
        }));

      } else {
        if (hasCategory) {
          const slugList = slugsFromAnalysisResult(analysisResult);
          setFormData(prev => ({
            ...prev,
            aiCategories: slugList,
            aiCategory: slugList[0] ?? analysisResult.category ?? prev.aiCategory ?? 'scenic',
            aiCategoryName: analysisResult.categoryName ?? prev.aiCategoryName ?? '추천장소',
            aiCategoryIcon: analysisResult.categoryIcon ?? prev.aiCategoryIcon ?? '🏞️'
          }));
        }
        // AI 태그가 없으면: 날씨 2 + 분위기 2(기본) + 분석(위치/노트 기반) 2
        const weatherPick = pickTwo(weatherTags).map(formatHash).filter(Boolean);
        const moodPick = pickTwo(buildMoodTags(null, note)).map(formatHash).filter(Boolean);
        const analysisPick = pickTwo([
          location?.split(' ')[0] ? `${location.split(' ')[0]} 여행` : '',
          '산책 코스',
          '포토 스팟',
          '감성 스팟',
        ]).map(formatHash).filter(Boolean);
        setAutoTags(dedupeHashtags([...weatherPick, ...moodPick, ...analysisPick]).slice(0, 6));

        if (!hasCategory) {
          setFormData(prev => ({
            ...prev,
            aiCategory: 'scenic',
            aiCategories: ['scenic'],
            aiCategoryName: '추천장소',
            aiCategoryIcon: '🏞️'
          }));
        }
      }

    } catch (error) {
      logger.error('AI 분석 실패:', error);
      // 로컬 생성 태그는 제거(요청). 실패 시에는 추천 태그를 비웁니다.
      setAutoTags([]);

      setFormData(prev => ({
        ...prev,
        aiCategory: 'scenic',
        aiCategories: ['scenic'],
        aiCategoryName: '추천장소',
        aiCategoryIcon: '🏞️'
      }));
    } finally {
      setLoadingAITags(false);
    }
  }, [combinedLocation, formData.note, formData.tags]);

  const lastExifAiKeyRef = useRef('');

  // 첫 번째 로컬 이미지 EXIF는 한 번만 파싱하고, 동의 없으면 읽지 않음
  useEffect(() => {
    const f = formData.imageFiles[0];
    if (!f || f.type.startsWith('video/')) {
      setExifExtracting(false);
      setExifGeoResolving(false);
      if (!f && !editingPostId) {
        lastExifAiKeyRef.current = '';
        setFormData((prev) =>
          prev.exifForFileKey || prev.exifData
            ? {
                ...prev,
                exifData: null,
                exifForFileKey: null,
                photoDate: null,
                verifiedLocation: null,
              }
            : prev
        );
      }
      return;
    }

    const fk = `${f.name}:${f.size}:${f.lastModified}`;

    if (!exifAllowed) {
      setExifExtracting(false);
      setExifGeoResolving(false);
      if (formData.exifForFileKey === fk) {
        return;
      }
      setFormData((prev) => ({
        ...prev,
        exifData: null,
        exifForFileKey: fk,
        photoDate: null,
        verifiedLocation: null,
      }));
      if (lastExifAiKeyRef.current !== fk) {
        lastExifAiKeyRef.current = fk;
        analyzeImageAndGenerateTags(f, locNoteRef.current.location, locNoteRef.current.note, null);
      }
      return;
    }

    if (formData.exifForFileKey === fk) {
      setExifExtracting(false);
      setExifGeoResolving(false);
      return;
    }

    let cancelled = false;
    setExifExtracting(true);

    (async () => {
      try {
        logger.log('📸 EXIF 데이터 추출 시작...');
        const exifData = await extractExifData(f, { allowed: true });
        if (cancelled) return;

        if (exifData) {
          logger.log('✅ EXIF 데이터 추출 성공:', {
            hasDate: !!exifData.photoDate,
            hasGPS: !!exifData.gpsCoordinates,
            photoDate: exifData.photoDate,
            gps: exifData.gpsCoordinates,
          });

          const exifCoordinates = exifData.gpsCoordinates
            ? { lat: exifData.gpsCoordinates.lat, lng: exifData.gpsCoordinates.lng }
            : null;

          // 1) EXIF 파싱 결과는 즉시 반영 (촬영 시각·기기 정보 등 빠르게 UI 노출)
          setFormData((prev) => ({
            ...prev,
            exifData,
            exifForFileKey: fk,
            photoDate: exifData.photoDate || null,
            // verifiedLocation은 좌표 → 주소 변환이 끝난 뒤에만 채움
            verifiedLocation: prev.verifiedLocation || null,
            coordinates: prev.coordinates || exifCoordinates || null,
          }));

          // 2) GPS → 주소 변환은 비동기로 따로 진행 (EXIF UI를 늦추지 않음)
          if (exifCoordinates) {
            setExifGeoResolving(true);
            void (async () => {
              try {
                const verifiedLocation = await convertGpsToAddress(exifCoordinates.lat, exifCoordinates.lng);
                if (cancelled) return;
                if (!verifiedLocation) return;
                logger.log('📍 EXIF GPS 주소 변환 성공:', verifiedLocation);
                setFormData((prev) => {
                  // 사용자가 이미 수동으로 입력했으면 덮어쓰지 않음
                  const hasManual = String(prev.locationRegion || '').trim() || String(prev.locationPlace || '').trim();
                  const sp = splitLocationForForm(verifiedLocation);
                  return {
                    ...prev,
                    verifiedLocation,
                    locationRegion: hasManual ? prev.locationRegion : (prev.locationRegion || sp.region),
                    locationPlace: hasManual ? prev.locationPlace : (prev.locationPlace || sp.place),
                    coordinates: prev.coordinates || exifCoordinates || null,
                  };
                });
              } catch (error) {
                logger.warn('GPS 주소 변환 실패:', error);
              } finally {
                if (!cancelled) setExifGeoResolving(false);
              }
            })();
          } else {
            setExifGeoResolving(false);
            getCurrentLocation();
          }
        } else {
          logger.log('ℹ️ EXIF 데이터 없음 - 기본 위치 감지 사용');
          setFormData((prev) => ({
            ...prev,
            exifData: null,
            exifForFileKey: fk,
            photoDate: null,
            verifiedLocation: null,
          }));
          setExifGeoResolving(false);
          getCurrentLocation();
        }

        const { location: loc, note } = locNoteRef.current;
        lastExifAiKeyRef.current = fk;
        analyzeImageAndGenerateTags(f, loc, note, exifData ?? null);
      } catch (error) {
        logger.warn('EXIF 추출 실패:', error);
        if (!cancelled) {
          setFormData((prev) => ({
            ...prev,
            exifData: null,
            exifForFileKey: fk,
            photoDate: null,
            verifiedLocation: null,
          }));
          setExifGeoResolving(false);
          getCurrentLocation();
          const { location: loc, note } = locNoteRef.current;
          lastExifAiKeyRef.current = fk;
          analyzeImageAndGenerateTags(f, loc, note, null);
        }
      } finally {
        if (!cancelled) setExifExtracting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    editingPostId,
    firstImageFileKey,
    exifAllowed,
    formData.exifForFileKey,
    analyzeImageAndGenerateTags,
    getCurrentLocation,
  ]);

  const generateVideoTags = useCallback(async (locationName = '', noteText = '') => {
    const regionName = locationName?.split(' ')[0] || locationName || '';
    let weatherTags = [];
    if (regionName) {
      try {
        const weather = await getWeatherCached(regionName);
        if (weather) {
          weatherTags = buildWeatherTagsFromCondition(
            weather.condition,
            weather.temperature
          );
        }
      } catch (e) {
        logger.warn('동영상 날씨 태그 생성 실패 (무시):', e);
      }
    }

    // 동영상: 날씨 2 + 분위기 2 + 분석(텍스트 기반) 2
    const weatherPick = pickTwo(weatherTags).map(formatHash).filter(Boolean);
    const moodPick = pickTwo(buildMoodTags(null, noteText)).map(formatHash).filter(Boolean);
    const analysisPick = pickTwo([
      locationName ? `${locationName.split(' ')[0]} 지금` : '',
      '현장 분위기',
      '리얼 후기',
      '영상 기록',
    ]).map(formatHash).filter(Boolean);
    setAutoTags(dedupeHashtags([...weatherPick, ...moodPick, ...analysisPick]).slice(0, 6));
  }, []);

  const processMediaFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      const MAX_SIZE = 50 * 1024 * 1024;
      const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 동영상은 100MB까지

      const imageFiles = [];
      const videoFiles = [];

      const isVideoFile = (file) => {
        const t = String(file?.type || '').toLowerCase();
        if (t.startsWith('video/')) return true;
        // 모바일(특히 iOS Safari)에서 type이 비는 케이스 방어: 확장자로 판단
        const name = String(file?.name || '').toLowerCase().trim();
        const ext = name.includes('.') ? name.split('.').pop() : '';
        return ['mp4', 'mov', 'm4v', 'webm', '3gp', '3gpp', '3g2', 'mkv'].includes(String(ext || ''));
      };

      for (const file of files) {
        const isVideo = isVideoFile(file);
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_SIZE;

        if (file.size > maxSize) {
          alert(`${file.name}은(는) ${isVideo ? '100MB' : '50MB'}를 초과합니다`);
          continue;
        }

        if (isVideo) {
          videoFiles.push(file);
        } else {
          imageFiles.push(file);
        }
      }

      const imageUrls = imageFiles.map((file) => URL.createObjectURL(file));
      const videoUrls = videoFiles.map((file) => URL.createObjectURL(file));
      const isFirstMedia = formData.images.length === 0 && formData.videos.length === 0;

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...imageUrls],
        imageFiles: [...prev.imageFiles, ...imageFiles],
        videos: [...prev.videos, ...videoUrls],
        videoFiles: [...prev.videoFiles, ...videoFiles],
      }));

      if (isFirstMedia && (imageFiles.length > 0 || videoFiles.length > 0)) {
        const firstNewImage = imageFiles[0];
        if (!firstNewImage || firstNewImage.type.startsWith('video/')) {
          getCurrentLocation();
          generateVideoTags(combinedLocation, formData.note);
        }
      }
    },
    [formData.images.length, formData.videos.length, combinedLocation, formData.note, getCurrentLocation, generateVideoTags]
  );

  const handleImageSelect = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      processMediaFiles(files);
    },
    [processMediaFiles]
  );


  // 추천 태그는 "첫 사진 추가 시 1회"만 생성 (이후 위치/설명 입력 변경으로 재분석하지 않음)

  useEffect(() => {
    if (formData.imageFiles.length > 0) return;
    if (formData.videoFiles.length === 0) return;
    generateVideoTags(combinedLocation, formData.note);
  }, [formData.videoFiles, formData.imageFiles.length, combinedLocation, formData.note, generateVideoTags]);

  // 태그가 변경될 때마다 자동 태그에서 이미 등록된 태그 제거
  useEffect(() => {
    if (autoTags.length === 0) return;

    const existingTags = formData.tags.map(tag =>
      tag.replace('#', '').toLowerCase()
    );

    setAutoTags(prev => {
      const filtered = prev.filter(tag => {
        const tagClean = tag.replace('#', '').toLowerCase();
        return !existingTags.includes(tagClean);
      });
      return dedupeHashtags(filtered);
    });
  }, [formData.tags, autoTags.length]);

  const handlePhotoOptionSelect = useCallback((option) => {
    setShowPhotoOptions(false);
    if (option === 'camera') {
      setShowCameraCapture(true);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = handleImageSelect;
    input.click();
  }, [handleImageSelect]);

  useEffect(() => {
    if (!showCameraCapture) {
      setCameraPreviewStream((prev) => {
        if (prev) prev.getTracks().forEach((t) => t.stop());
        return null;
      });
      setCameraTorchOn(false);
      setCameraTorchSupported(false);
      return;
    }
    let cancelled = false;
    let stream = null;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          alert('이 환경에서는 카메라 API를 사용할 수 없습니다.');
          setShowCameraCapture(false);
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: cameraFacingMode }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // torch 지원 여부 탐지 (지원 시에만 플래시 버튼 동작)
        try {
          const track = stream.getVideoTracks?.()[0];
          const caps = track?.getCapabilities?.();
          setCameraTorchSupported(!!caps?.torch);
        } catch {
          setCameraTorchSupported(false);
        }
        setCameraPreviewStream(stream);
      } catch (err) {
        logger.warn('카메라 시작 실패:', err);
        alert('카메라를 켤 수 없습니다. 권한과 브라우저 설정을 확인해 주세요.');
        setShowCameraCapture(false);
      }
    })();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [showCameraCapture, cameraFacingMode]);

  const toggleCameraFacing = useCallback(() => {
    setCameraFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    // 전면/후면 전환 시 torch는 꺼두기 (일부 기기에서 충돌)
    setCameraTorchOn(false);
  }, []);

  const toggleCameraTorch = useCallback(() => {
    const stream = cameraPreviewStream;
    const track = stream?.getVideoTracks?.()?.[0];
    if (!track) return;
    try {
      const caps = track.getCapabilities?.();
      if (!caps?.torch) {
        setCameraTorchSupported(false);
        alert('이 기기에서는 플래시(손전등)를 지원하지 않습니다.');
        return;
      }
      const next = !cameraTorchOn;
      track.applyConstraints({ advanced: [{ torch: next }] });
      setCameraTorchOn(next);
      setCameraTorchSupported(true);
    } catch (e) {
      logger.debug('torch applyConstraints 실패:', e);
      alert('플래시를 켤 수 없습니다.');
    }
  }, [cameraPreviewStream, cameraTorchOn]);

  const openGalleryFromCamera = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = handleImageSelect;
    input.click();
  }, [handleImageSelect]);

  useEffect(() => {
    const el = cameraVideoRef.current;
    if (!el || !cameraPreviewStream) return;
    el.srcObject = cameraPreviewStream;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [cameraPreviewStream, showCameraCapture]);

  const captureFromCamera = useCallback(() => {
    const video = cameraVideoRef.current;
    if (!video || video.readyState < 2) {
      alert('카메라 화면이 준비될 때까지 잠시만 기다려 주세요.');
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert('사진을 저장하지 못했습니다.');
          return;
        }
        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        processMediaFiles([file]);
        setShowCameraCapture(false);
      },
      'image/jpeg',
      0.92
    );
  }, [processMediaFiles]);

  const addTag = useCallback(() => {
    const parsed = parseTagsFromInput(tagInput);
    if (!parsed.length) return;

    const next = dedupeHashtags([
      ...(formData.tags || []),
      ...parsed.map((t) => `#${t}`),
    ]);

    setFormData((prev) => ({
      ...prev,
      tags: next,
    }));
    setTagInput('');
  }, [tagInput, formData.tags]);

  const removeTag = useCallback((tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  }, []);

  const addAutoTag = useCallback((tag) => {
    const cleanTag = tag.replace('#', '');

    const alreadyExists = formData.tags.some(t => {
      const tClean = t.replace('#', '').toLowerCase();
      return tClean === cleanTag.toLowerCase();
    });

    if (!alreadyExists) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag.startsWith('#') ? tag : `#${cleanTag}`]
      }));
      // 추가된 태그를 자동 태그 목록에서 제거
      setAutoTags(prev => prev.filter(t => {
        const tClean = t.replace('#', '').toLowerCase();
        return tClean !== cleanTag.toLowerCase();
      }));
      logger.log('태그 추가:', cleanTag);
    }
  }, [formData.tags]);

  const checkAndAwardBadge = useCallback(async () => {
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.log('🏆 뱃지 체크 및 획득 시작');
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const currentUser = user || null;
      const currentUserId = currentUser?.id ? String(currentUser.id) : '';
      if (!currentUserId) {
        logger.warn('뱃지 체크: 로그인 사용자 없음');
        return false;
      }

      // 서버 운영 전환: localStorage 병합 제거, Supabase 기준으로만 내 게시물 로드
      const myPosts = await fetchPostsByUserIdSupabase(currentUserId, currentUserId);
      logger.log(`📊 사용자 통계 계산 중... (총 ${myPosts.length}개 게시물)`);

      const stats = calculateUserStats(myPosts, currentUser);
      logger.debug('📈 계산된 통계:', {
        totalPosts: stats.totalPosts,
        totalLikes: stats.totalLikes,
        visitedRegions: stats.visitedRegions
      });

      const newBadges = checkNewBadges(stats);
      logger.log(`📋 발견된 새 뱃지: ${newBadges.length}개`);

      if (newBadges.length > 0) {
        let awardedCount = 0;

        newBadges.forEach((badge, index) => {
          logger.log(`\n🎯 뱃지 ${index + 1}/${newBadges.length} 처리 중: ${badge.name}`);
          logger.debug(`   난이도: ${badge.difficulty}`);
          logger.debug(`   설명: ${badge.description}`);

          const awarded = awardBadge(badge, { region: stats?.topRegionName, userId: currentUserId });
          if (awarded) {
            awardedCount++;
            logger.log(`   ✅ 뱃지 획득 성공: ${badge.name}`);

            // 첫 번째 뱃지만 모달 표시
            if (index === 0) {
              notifyBadge(badge.name, badge.difficulty);
              logger.log('   📢 알림 전송 완료');

              setEarnedBadge(badge);
              setShowBadgeModal(true);
              if (typeof setBadgeAnimationKeyRef.current === 'function') {
                setBadgeAnimationKeyRef.current(prev => prev + 1);
              }
              logger.log('   🎉 뱃지 모달 표시');

              // 경험치 시스템 제거됨
              // gainExp(`뱃지 획득 (${badge.difficulty})`);
            }
          } else {
            logger.log(`   ❌ 뱃지 획득 실패: ${badge.name}`);
          }
        });

        logger.log(`\n✅ 총 ${awardedCount}개의 뱃지 획득 완료`);
        logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return awardedCount > 0;
      } else {
        logger.log('📭 획득 가능한 새 뱃지가 없습니다');
        logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return false;
      }
    } catch (error) {
      logger.error('❌ 뱃지 체크 오류:', error);
      logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return false;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    logger.log('Upload started!');
    logger.debug('Image count:', formData.images.length);
    logger.debug('Location:', combinedLocation);

    if (formData.images.length === 0 && formData.videos.length === 0) {
      alert('사진 또는 동영상을 추가해주세요');
      return;
    }

    if (!combinedLocation.trim()) {
      alert('위치를 입력해주세요');
      return;
    }

    if (!formData.note.trim()) {
      alert('설명을 입력해주세요');
      return;
    }

    if (isExifCaptureBlocked) {
      alert(
        'EXIF 기준 촬영 시각이 48시간을 넘긴 사진은 업로드할 수 없습니다. 최근에 찍은 사진을 선택하거나 촬영하기로 새로 찍어 주세요.'
      );
      return;
    }

    // 업로드는 Supabase에 저장되므로 로그인/세션이 없으면 실패할 확률이 높음 → 먼저 차단
    if (!user?.id) {
      alert('로그인이 필요합니다. 로그인 후 다시 업로드해 주세요.');
      return;
    }

    const pendingTag = normalizeTag(tagInput);
    let finalTags = dedupeHashtags([...(formData.tags || [])]);
    if (pendingTag) {
      const low = pendingTag.toLowerCase();
      if (!finalTags.some((t) => normalizeTag(t).toLowerCase() === low)) {
        finalTags = dedupeHashtags([...finalTags, `#${pendingTag}`]);
      }
    }
    if (pendingTag) {
      setTagInput('');
      setFormData((prev) => ({ ...prev, tags: finalTags }));
    }

    if (editingPostId) {
      try {
        setUploading(true);
        setUploadProgress(10);
        let imageFileIdx = 0;
        let videoFileIdx = 0;
        const finalImages = [];
        for (const preview of formData.images) {
          const isBlobPreview = typeof preview === 'string' && preview.startsWith('blob:');
          if (!isBlobPreview) {
            finalImages.push(preview);
          } else if (formData.imageFiles[imageFileIdx]) {
            const file = formData.imageFiles[imageFileIdx];
            imageFileIdx += 1;
            try {
              const uploadResult = await uploadImage(file);
              if (uploadResult.success && uploadResult.url) {
                finalImages.push(uploadResult.url);
              } else {
                finalImages.push(preview);
              }
            } catch (_) {
              finalImages.push(preview);
            }
          } else {
            finalImages.push(preview);
          }
        }
        const finalVideos = [];
        for (const preview of formData.videos) {
          const isBlobPreview = typeof preview === 'string' && preview.startsWith('blob:');
          if (!isBlobPreview) {
            finalVideos.push(preview);
          } else if (formData.videoFiles[videoFileIdx]) {
            const file = formData.videoFiles[videoFileIdx];
            videoFileIdx += 1;
            try {
              const uploadResult = await uploadVideo(file);
              if (uploadResult.success && uploadResult.url) {
                finalVideos.push(uploadResult.url);
              } else {
                finalVideos.push(preview);
              }
            } catch (_) {
              finalVideos.push(preview);
            }
          } else {
            finalVideos.push(preview);
          }
        }
        if (finalVideos.some((u) => typeof u === 'string' && u.startsWith('blob:'))) {
          alert('동영상 업로드에 실패했습니다. 네트워크/스토리지 설정을 확인한 뒤 다시 시도해 주세요.');
          return;
        }
        setUploadProgress(70);
        const tagPayload = dedupeHashtags(finalTags)
          .map((t) => t.replace(/^#+/, '').trim())
          .filter(Boolean);
        const region = normalizeRegionName(formData.locationRegion || combinedLocation.split(' ')[0] || '기타');
        const postIdStr = String(editingPostId);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postIdStr.trim());

        if (isUuid) {
          const res = await updatePostSupabase(postIdStr, {
            content: formData.note.trim() || `${combinedLocation}에서의 여행 기록`,
            location: combinedLocation.trim(),
            detailed_location: combinedLocation.trim(),
            place_name: combinedLocation.trim(),
            region,
            images: finalImages,
            videos: finalVideos,
            tags: tagPayload
          });
          if (!res?.success) {
            alert('저장에 실패했습니다. 다시 시도해주세요.');
            return;
          }
          const fresh = await fetchPostByIdSupabase(postIdStr);
          window.dispatchEvent(new Event('postsUpdated'));
          navigate(`/post/${postIdStr}`, { replace: true, state: fresh ? { post: fresh } : undefined });
        } else {
          alert('이 게시물은 서버에 저장된 게시물이 아니어서 편집할 수 없습니다.');
          navigate('/main', { replace: true });
          return;
        }
      } catch (err) {
        logger.error('게시물 수정 저장 실패:', err);
        alert('저장에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
      return;
    }

    logger.log('Validation passed - proceeding with upload');

    try {
      setUploading(true);
      setUploadProgress(10);

      const uploadedImageUrls = [];
      const uploadedVideoUrls = [];

      const aiCategory = formData.aiCategory || 'scenic';
      const aiCategoryName = formData.aiCategoryName || '추천장소';

      logger.debug('AI category:', aiCategoryName);

      const totalFiles = formData.imageFiles.length + formData.videoFiles.length;
      let uploadedCount = 0;
      const bumpProgress = () => {
        uploadedCount += 1;
        const denom = Math.max(1, totalFiles);
        setUploadProgress(20 + (uploadedCount * 40 / denom));
      };

      // 업로드가 오래 걸리는 원인 중 하나가 "순차 업로드"라서,
      // 여기서는 이미지/동영상을 제한 병렬(기본 3개 동시)로 올려 체감 시간을 줄인다.
      const mapWithConcurrency = async (items, limit, mapper) => {
        const arr = Array.isArray(items) ? items : [];
        const out = new Array(arr.length);
        let idx = 0;
        const worker = async () => {
          while (idx < arr.length) {
            const cur = idx++;
            // eslint-disable-next-line no-await-in-loop
            out[cur] = await mapper(arr[cur], cur);
          }
        };
        const n = Math.max(1, Math.min(limit || 3, arr.length || 1));
        await Promise.all(new Array(n).fill(0).map(() => worker()));
        return out;
      };

      // 이미지 업로드 (병렬)
      if (formData.imageFiles.length > 0) {
        const imageErrors = [];
        const results = await mapWithConcurrency(formData.imageFiles, 3, async (file, i) => {
          try {
            const r = await uploadImage(file);
            bumpProgress();
            if (r?.success && r.url) return r.url;
            imageErrors.push(r?.message || r?.error?.message || '사진 업로드 실패');
            return '';
          } catch (e) {
            bumpProgress();
            imageErrors.push(e?.message || '사진 업로드 실패');
            return '';
          }
        });
        uploadedImageUrls.push(...results.filter(Boolean));
        if (
          uploadedImageUrls.length < formData.imageFiles.length ||
          uploadedImageUrls.some((u) => typeof u === 'string' && u.startsWith('blob:'))
        ) {
          const detail = imageErrors.find(Boolean);
          alert(`사진 업로드에 실패했습니다.\n\n${detail ? `원인: ${detail}\n\n` : ''}네트워크/스토리지 설정을 확인한 뒤 다시 시도해 주세요.`);
          setUploading(false);
          setUploadProgress(0);
          return;
        }
      } else {
        uploadedImageUrls.push(...formData.images);
      }

      // 동영상 업로드 (병렬, 기본 2개 동시)
      if (formData.videoFiles.length > 0) {
        const videoErrors = [];
        const results = await mapWithConcurrency(formData.videoFiles, 2, async (file, i) => {
          try {
            const r = await uploadVideo(file);
            bumpProgress();
            if (r?.success && r.url) return r.url;
            videoErrors.push(r?.message || r?.error?.message || '동영상 업로드 실패');
            return '';
          } catch (e) {
            bumpProgress();
            videoErrors.push(e?.message || '동영상 업로드 실패');
            return '';
          }
        });
        uploadedVideoUrls.push(...results.filter(Boolean));
        if (
          uploadedVideoUrls.length < formData.videoFiles.length ||
          uploadedVideoUrls.some((u) => typeof u === 'string' && u.startsWith('blob:'))
        ) {
          const detail = videoErrors.find(Boolean);
          alert(`동영상 업로드에 실패했습니다.\n\n${detail ? `원인: ${detail}\n\n` : ''}잠시 후 다시 시도해 주세요.`);
          setUploading(false);
          setUploadProgress(0);
          return;
        }
      } else {
        uploadedVideoUrls.push(...formData.videos);
      }

      setUploadProgress(60);

      let coordinates = formData.coordinates || (formData.exifData?.gpsCoordinates ? {
        lat: formData.exifData.gpsCoordinates.lat,
        lng: formData.exifData.gpsCoordinates.lng
      } : null);

      if (!coordinates && combinedLocation.trim()) {
        const geo = await searchPlaceWithKakaoFirst(combinedLocation.trim());
        if (geo && !Number.isNaN(geo.lat) && !Number.isNaN(geo.lng)) {
          coordinates = { lat: geo.lat, lng: geo.lng };
          logger.log('📍 위치 문구로 카카오 좌표 확정:', geo.placeName || geo.address, coordinates);
        }
      }
      if (!coordinates) {
        logger.warn('📍 좌표를 확정하지 못했습니다. 지도에서는 장소명 검색으로 표시됩니다.');
      }

      const formatDateLabel = (ts) => {
        const d = new Date(Number(ts) || Date.now());
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}.${m}.${day}`;
      };

      const withDateInDescription = (rawNote, ts) => {
        const note = String(rawNote || '').trim();
        const dateLabel = formatDateLabel(ts);
        if (note.startsWith(dateLabel)) return note;
        if (note.startsWith(`[${dateLabel}]`)) return note;
        if (!note) return `${dateLabel} ${combinedLocation}에서의 여행 기록`;
        return `${dateLabel} ${note}`;
      };

      setUploadProgress(80);

      // 서버 운영 전환: localStorage 기반 사용자/게시물 저장 로직 제거, Supabase만 사용

          // 이미지 URL 확인 및 설정
          const finalImages = uploadedImageUrls.length > 0
            ? uploadedImageUrls
            : (formData.images && formData.images.length > 0 ? formData.images : []);
          const finalVideos = uploadedVideoUrls.length > 0
            ? uploadedVideoUrls
            : (formData.videos && formData.videos.length > 0 ? formData.videos : []);

          const supabaseImageCount = (finalImages || []).filter((u) => typeof u === 'string' && u.startsWith('https://')).length;
          logger.log('📸 최종 이미지/동영상:', {
            images: finalImages.length,
            videos: finalVideos.length,
            supabase저장된사진수: supabaseImageCount,
            imageUrls: finalImages,
            videoUrls: finalVideos
          });
          if (supabaseImageCount > 0) {
            logger.log('✅ 사진이 Supabase Storage에 저장되었습니다.');
          }

          if (finalImages.length === 0 && finalVideos.length === 0) {
            logger.error('❌ 이미지 또는 동영상이 없습니다!');
            alert('이미지 또는 동영상이 업로드되지 않았습니다');
            setUploading(false);
            setUploadProgress(0);
            return;
          }

          // 지역 정보 추출 (첫 번째 단어 — 구미/구미시 등 표기 통일)
          const region = normalizeRegionName(formData.locationRegion || combinedLocation.split(' ')[0] || '기타');

          const resolvedPhotoDate =
            formData.photoDate || (isInAppCamera ? new Date().toISOString() : null);

          // EXIF·앱 내 촬영 기준 촬영 시각 (없으면 업로드 시각)
          const photoTimestamp = resolvedPhotoDate
            ? new Date(resolvedPhotoDate).getTime()
            : Date.now();

          // 업로드 시점의 날씨 정보 가져오기
          let weatherAtUpload = null;
          try {
            const weather = await getWeatherCached(region);
            if (weather) {
              const snapshotAt = new Date().toISOString();
              weatherAtUpload = {
                icon: weather.icon,
                condition: weather.condition,
                temperature: weather.temperature,
                fetchedAt: Date.now(),
                snapshotAt,
                snapshotLabel: '업로드 시점 기준 기록(고정)',
              };
            }
          } catch (weatherError) {
            logger.warn('업로드 시 날씨 정보 가져오기 실패 (무시):', weatherError);
          }

          const descriptionWithDate = withDateInDescription(formData.note, photoTimestamp);

          if (!user?.id) {
            alert('로그인이 필요합니다. 로그인 후 다시 업로드해 주세요.');
            setUploading(false);
            setUploadProgress(0);
            return;
          }

          const sanitizedPost = {
            userId: user.id,
            user: {
              id: user.id,
              username: user.username || user.email?.split('@')?.[0] || null,
              profileImage: user.profileImage || null,
            },
            images: finalImages,
            videos: finalVideos,
            location: combinedLocation,
            detailedLocation: formData.verifiedLocation || combinedLocation,
            placeName: combinedLocation,
            region,
            tags: Array.isArray(finalTags) ? finalTags : [],
            note: descriptionWithDate,
            content: descriptionWithDate,
            timestamp: photoTimestamp,
            createdAt: getCurrentTimestamp(),
            photoDate: resolvedPhotoDate,
            isInAppCamera: !!isInAppCamera,
            category: aiCategory,
            categories: Array.isArray(formData.aiCategories) ? formData.aiCategories : [aiCategory],
            categoryName: aiCategoryName,
            coordinates: coordinates || null,
            weather: weatherAtUpload,
            weatherSnapshot: weatherAtUpload,
            exifData: formData.exifData
              ? {
                  photoDate: formData.exifData.photoDate,
                  gpsCoordinates: formData.exifData.gpsCoordinates,
                  cameraMake: formData.exifData.cameraMake,
                  cameraModel: formData.exifData.cameraModel,
                }
              : null,
            verifiedLocation: formData.verifiedLocation || null,
          };

          // Supabase에 게시물 저장 (이미지/동영상은 https URL만 저장됨)
          const result = await createPostSupabase(sanitizedPost);
          if (!result?.success || !result?.post?.id) {
            logger.warn('Supabase 게시물 저장 실패:', result?.error, result?.code);
            alert('게시물 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            setUploading(false);
            setUploadProgress(0);
            return;
          }

          try {
            const warmUrl = finalImages[0] ? getDisplayImageUrl(finalImages[0]) : '';
            if (warmUrl && typeof Image !== 'undefined') {
              const im = new Image();
              im.decoding = 'async';
              im.src = warmUrl;
            }
          } catch (_) {}

          window.dispatchEvent(new Event('postsUpdated'));

          setUploadProgress(100);
          setShowSuccessModal(true);

          logger.log('Backend upload success! Checking badges...');

          // 보조 리스너용 (postsUpdated는 위에서 즉시 발생)
          setTimeout(() => {
            logger.log('📢 게시물 업데이트 이벤트 발생 (newPostsAdded)');
            window.dispatchEvent(new Event('newPostsAdded'));
            logger.log('✅ 이벤트 전송 완료');
          }, 100);

          // 데이터 저장 완료 후 뱃지 체크 (더 긴 지연 시간)
          setTimeout(() => {
            logger.debug('Badge check timer running');

            // 사진 업로드 시 레벨 상승 (실제 업로드만)
            // 경험치 시스템 제거됨
            /*
            const expResult = gainExp('사진 업로드');
            if (expResult.levelUp) {
              logger.log(`Level up! Lv.${expResult.newLevel}`);
              window.dispatchEvent(new CustomEvent('levelUp', { 
                detail: { 
                  newLevel: expResult.newLevel
                } 
              }));
            }
            */

            logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logger.log('🏆 뱃지 체크 시작');
            const earnedBadge = checkAndAwardBadge();
            logger.debug('Badge earned result:', earnedBadge);
            logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // 뱃지 진행률 업데이트 이벤트 발생
            window.dispatchEvent(new Event('badgeProgressUpdated'));

            if (earnedBadge) {
              logger.log('Badge earned! Showing badge modal...');
              setShowBadgeModal(true);
              // 뱃지 모달 표시 후 3초 뒤 메인으로 이동
              setTimeout(() => {
                setShowSuccessModal(false);
                setShowBadgeModal(false);
                navigate('/main');
              }, 3000);
            } else {
              logger.debug('Navigate to main in 2 seconds...');
              setTimeout(() => {
                setShowSuccessModal(false);
                navigate('/main');
              }, 2000);
            }
          }, 1000); // 500ms -> 1000ms로 증가하여 데이터 저장 완료 대기
        }
    catch (error) {
      logger.error('Upload failed:', error);
      alert('업로드에 실패했습니다. 다시 시도해주세요');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [formData, user, navigate, checkAndAwardBadge, editingPostId, tagInput, isExifCaptureBlocked]);

  if (editingPostId && !editFormReady) {
    return (
      <div className="screen-layout bg-background-light dark:bg-background-dark flex min-h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-600 dark:text-gray-400">게시물을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 업로드 가이드 팝업 제거: 가이드는 `/upload/guide` 화면 하나만 사용 */}

      <div className="phone-screen" style={{
        background: '#ffffff',
        borderRadius: '32px',
        overflow: 'hidden',
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* 상태바 영역 (시스템 UI 제거, 공간만 유지) */}
        <div style={{ height: '20px' }} />

        {/* 앱 헤더 - 개인 기록 느낌 */}
        <header className="app-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'transparent',
          color: '#111827',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <button
            onClick={() => {
              if (editingPostId) {
                navigate(`/post/${editingPostId}`, { replace: false });
              } else if (location.state?.fromMap) {
                navigate('/main');
              } else {
                navigate(-1);
              }
            }}
            className="flex size-12 shrink-0 items-center justify-center text-content-light dark:text-content-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold" style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#00BCD4',
              fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              marginBottom: '2px'
            }}>{editingPostId ? '게시물 수정' : '지금 현장 상황'}</h1>
            <p className="text-xs text-gray-500" style={{ fontSize: '12px' }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
          <div className="w-10"></div>
        </header>

        {/* 앱 컨텐츠 */}
        <main className="app-content" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 16px 24px 16px',
          background: 'transparent',
          WebkitOverflowScrolling: 'touch',
          minHeight: 0
        }}>
          <div className="pt-4 space-y-5">
            {/* 사진 / 동영상 + 업로드 가이드 버튼 한 줄 */}
            <div className="flex items-center justify-between px-1 mb-1">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                사진 / 동영상
              </h3>
              <button
                type="button"
                onClick={() => navigate('/upload/guide')}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span>업로드 가이드</span>
              </button>
            </div>

            {/* 사진 / 동영상 선택 — 단일 큰 박스 */}
            <div className="space-y-3">

              {(formData.images.length === 0 && formData.videos.length === 0) ? (
                <button
                  type="button"
                  onClick={() => setShowPhotoOptions(true)}
                  className="w-full rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary-soft/20 transition-colors"
                  style={{
                    minHeight: '160px',
                    maxHeight: '50vh',
                    padding: '24px 16px'
                  }}
                >
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    사진, 동영상 추가하기
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    일반 사진·동영상 모두 추가할 수 있어요. 서버에는 위치·촬영 정보가 붙지 않은 이미지로 저장돼요. 동영상은 파일당 100MB까지예요.
                  </p>
                </button>
              ) : (
                <div className="space-y-3">
                  {/* 개수 요약 + 촬영 시간 */}
                  <div className="flex flex-col gap-1 px-1 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {formData.images.length > 0 && (
                        <span>사진 {formData.images.length}장</span>
                      )}
                      {formData.videos.length > 0 && (
                        <span>동영상 {formData.videos.length}개</span>
                      )}
                      {formData.imageFiles?.length > 0 && (
                        <StatusBadge status={photoStatus} />
                      )}
                    </div>
                    {validatingPhoto && formData.imageFiles?.length > 0 && (
                      <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <div className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent" />
                        <span>촬영 정보 확인 중...</span>
                      </div>
                    )}
                    {!validatingPhoto && exifGeoResolving && (
                      <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <div className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent" />
                        <span>촬영 위치 확인 중...</span>
                      </div>
                    )}
                    {formData.photoDate && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {(() => {
                          const formatted = formatExifDate(formData.photoDate);
                          const dateObj = new Date(formData.photoDate);
                          const timeText = isNaN(dateObj.getTime())
                            ? ''
                            : dateObj.toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                          return (
                            <>
                              <span className="mr-1 text-[11px] font-medium text-teal-600">
                                EXIF 기준 촬영 시간
                              </span>
                              <span>
                                {formatted ? `${formatted} · ${timeText}` : timeText}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {formData.exifData?.cameraModel && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="mr-1 font-medium text-slate-600 dark:text-slate-300">촬영 기기</span>
                        <span>{String(formData.exifData.cameraMake || '').trim()} {String(formData.exifData.cameraModel || '').trim()}</span>
                      </div>
                    )}
                    {formData.photoDate && formData.images.length > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        선택한 파일에서 읽은 촬영 시각이에요. 업로드되는 이미지 본문에서는 메타데이터가 제거돼요.
                      </p>
                    )}
                    {!validatingPhoto && formData.imageFiles?.length > 0 && photoStatus === 'NONE' && !isExifCaptureBlocked && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        정보가 부족하여 인증 배지 없이 공유됩니다.
                      </p>
                    )}
                    {isExifCaptureBlocked && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                        EXIF 촬영 시각이 48시간을 넘겼습니다. 다른 사진을 선택하거나 촬영하기로 새로 찍어 주세요.
                      </p>
                    )}
                  </div>

                  {/* 가로 한 줄 슬라이드 미리보기 */}
                  <div
                    className="flex gap-2 overflow-x-auto pb-1 -mx-1 scrollbar-thin [&::-webkit-scrollbar]:h-1"
                    onMouseDown={(e) => { if (!e.target.closest('button')) handleDragStart(e); }}
                  >
                    {formData.images.map((image, index) => (
                      <div
                        key={`img-row-${index}`}
                        className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100"
                      >
                        <img src={image} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({
                              ...prev,
                              images: prev.images.filter((_, i) => i !== index),
                              imageFiles: prev.imageFiles.filter((_, i) => i !== index)
                            }));
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center text-sm font-semibold shadow-md backdrop-blur-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {formData.videos.map((video, index) => (
                      <div
                        key={`vid-row-${index}`}
                        className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100"
                      >
                        <video src={video} className="w-full h-full object-cover" muted />
                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs drop-shadow">동영상</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({
                              ...prev,
                              videos: prev.videos.filter((_, i) => i !== index),
                              videoFiles: prev.videoFiles.filter((_, i) => i !== index)
                            }));
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {/* 업로드 개수 제한 없이 항상 + 버튼 노출 */}
                    <button
                      type="button"
                      onClick={() => setShowPhotoOptions(true)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex-shrink-0 w-24 h-24 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary text-2xl font-light"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 위치: 한 줄 입력 → 내부는 지역 + 세부 장소로 분리 저장 */}
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">위치</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-primary-soft bg-white focus:border-primary focus:ring-2 focus:ring-primary-soft min-h-[40px] h-10 px-3 text-sm font-normal placeholder:text-gray-400"
                    placeholder="예: 대구 송해공원"
                    value={formData.locationLine ?? combinedLocation}
                    onChange={(e) => {
                      const line = e.target.value; // 공백/끝 공백 포함 원문 유지
                      const { region, place } = splitLocationForForm(line);
                      setFormData((prev) => ({
                        ...prev,
                        locationLine: line,
                        locationRegion: region,
                        locationPlace: place,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={loadingLocation}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '9999px',
                      border: 'none',
                      background: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: loadingLocation ? 'not-allowed' : 'pointer',
                      opacity: loadingLocation ? 0.5 : 1,
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                    title="현재 위치 자동 입력"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00BCD4' }}>
                      {loadingLocation ? 'hourglass_empty' : 'my_location'}
                    </span>
                  </button>
                </div>
                {loadingLocation && (
                  <p className="text-xs text-primary">위치를 찾고 있어요...</p>
                )}
              </div>
            </div>

            {/* 태그 */}
            <div>
              <label className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-base font-semibold text-gray-800">태그</p>
                  {loadingAITags && (
                    <span className="text-xs text-primary">AI 분석 중...</span>
                  )}
                </div>
                <div className="flex w-full items-stretch gap-2">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-primary-soft bg-white focus:border-primary focus:ring-2 focus:ring-primary-soft min-h-[40px] h-10 px-3 text-sm font-normal placeholder:text-gray-400"
                    placeholder="#맑음 #화창한날씨"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <button
                    onClick={addTag}
                    className="flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl min-h-[40px] h-10 px-4 bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-all"
                  >
                    <span>추가</span>
                  </button>
                </div>
              </label>

              {loadingAITags && (
                <div className="mt-3 p-3 bg-primary-soft/50 rounded-lg border border-primary-soft">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-medium text-primary">
                      AI 분석 중...
                    </p>
                  </div>
                </div>
              )}


              {formData.aiCategoryName && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">AI 분류</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 py-1 px-2.5 text-xs font-medium">
                    {formData.aiCategoryIcon && <span>{formData.aiCategoryIcon}</span>}
                    {formData.aiCategoryName}
                  </span>
                </div>
              )}
              {!loadingAITags && autoTags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1.5">추천 태그</p>
                  <div className="flex flex-wrap gap-1.5">
                    {autoTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => addAutoTag(tag)}
                        className="rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary py-1 px-2 text-[11px] font-medium text-gray-700 transition-all"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.tags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-600 mb-1.5">내 태그</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <div
                        key={tag}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 border border-gray-200 py-1.5 px-3 min-h-[32px] text-xs text-gray-800 font-medium leading-tight"
                      >
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(tag)}
                          className="flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full w-5 h-5 min-w-[20px] min-h-[20px] text-xs transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 설명 */}
            <div>
              <label className="flex flex-col">
                <p className="text-base font-semibold text-gray-800 mb-3">설명</p>
                <div className="relative">
                  <textarea
                    className="form-textarea w-full rounded-2xl border border-primary-soft bg-white focus:border-primary focus:ring-2 focus:ring-primary-soft px-4 py-3 text-sm font-normal text-gray-900 placeholder:text-[11px] placeholder:whitespace-nowrap resize-none leading-relaxed min-h-[150px]"
                    placeholder="지금 이곳의 생생한 현장 상황을 자유롭게 입력해주세요."
                    rows="6"
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      lineHeight: '1.5'
                    }}
                  />
                </div>
              </label>
            </div>

            {/* 폼 하단 업로드 버튼 (고정 X, 맨 아래에서 누르게) */}
            <div style={{ paddingTop: 12, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}>
              <button
                type="button"
                onClick={() => {
                  handleSubmit();
                }}
                disabled={
                  uploading ||
                  (formData.images.length + formData.videos.length) === 0 ||
                  !combinedLocation.trim() ||
                  !formData.note.trim() ||
                  isExifCaptureBlocked
                }
                className={`flex w-full items-center justify-center rounded-full min-h-[44px] h-11 px-4 text-sm font-semibold text-white transition-all ${
                  uploading ||
                  (formData.images.length + formData.videos.length) === 0 ||
                  !combinedLocation.trim() ||
                  !formData.note.trim() ||
                  isExifCaptureBlocked
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark active:scale-[0.98] transform'
                }`}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>{editingPostId ? '저장 중...' : '업로드 중...'}</span>
                  </>
                ) : (
                  <span>{editingPostId ? '저장하기' : '업로드하기'}</span>
                )}
              </button>
              {isExifCaptureBlocked && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center mt-2 font-medium">
                  촬영 시각(EXIF)이 48시간을 넘긴 사진은 업로드할 수 없습니다.
                </p>
              )}
              {!isExifCaptureBlocked &&
                ((formData.images.length + formData.videos.length) === 0 ||
                  !combinedLocation.trim() ||
                  !formData.note.trim()) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  {(formData.images.length + formData.videos.length) === 0
                    ? '사진 또는 동영상을 추가해주세요'
                    : !combinedLocation.trim()
                      ? '위치를 입력해주세요'
                      : '설명을 입력해주세요'}
                </p>
              )}
            </div>
          </div>
        </main>

        {/* 하단 네비게이션 바 */}
        <BottomNavigation />

        {/* 업로드 중 로딩 모달 */}
        {uploading && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 dark:bg-black/80 p-4">
            <div className="w-full max-w-sm transform flex-col rounded-xl bg-white dark:bg-[#221910] p-8 shadow-2xl transition-all">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="flex items-center justify-center w-24 h-24 rounded-full bg-primary/10">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
                </div>
              </div>

              <h1 className="text-[#181411] dark:text-gray-100 text-[24px] font-bold leading-tight tracking-[-0.015em] text-center mb-2">
                업로드 중...
              </h1>

              <p className="text-gray-600 dark:text-gray-400 text-base font-normal leading-normal pb-6 text-center">
                여행 기록을 업로드하고 있습니다
              </p>

              {/* 진행률 바 */}
              <div className="mb-4">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {uploadProgress < 30 ? '파일 준비 중...' :
                      uploadProgress < 60 ? '이미지 업로드 중...' :
                        uploadProgress < 80 ? '게시물 저장 중...' :
                          uploadProgress < 100 ? '처리 중...' : '완료!'}
                  </p>
                  <p className="text-sm font-semibold text-primary">
                    {uploadProgress}%
                  </p>
                </div>
              </div>

              {/* 단계 표시 */}
              <div className="flex justify-center gap-2 mt-4">
                <div className={`w-2 h-2 rounded-full transition-all ${uploadProgress >= 20 ? 'bg-primary' : 'bg-gray-300'}`}></div>
                <div className={`w-2 h-2 rounded-full transition-all ${uploadProgress >= 60 ? 'bg-primary' : 'bg-gray-300'}`}></div>
                <div className={`w-2 h-2 rounded-full transition-all ${uploadProgress >= 80 ? 'bg-primary' : 'bg-gray-300'}`}></div>
                <div className={`w-2 h-2 rounded-full transition-all ${uploadProgress >= 100 ? 'bg-primary' : 'bg-gray-300'}`}></div>
              </div>
            </div>
          </div>
        )}

        {showCameraCapture && (
          <div className="absolute inset-0 z-[70] bg-black">
            {/* 카메라 프리뷰 (풀 스크린) */}
            <video
              ref={cameraVideoRef}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              playsInline
            />

            {/* 버튼 오버레이만 (상/하 검은 띠 제거) */}
            <div className="absolute inset-0 pointer-events-none">
              {/* 상단: 갤러리 / 전환 / 플래시 / 닫기 */}
              <div
                className="absolute left-0 right-0 top-0 flex items-center justify-between px-4"
                style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
              >
                <button
                  type="button"
                  onClick={openGalleryFromCamera}
                  className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-sm"
                  aria-label="갤러리"
                >
                  <span className="material-symbols-outlined text-[22px] text-white">image</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-sm"
                    aria-label="카메라 전환"
                  >
                    <span className="material-symbols-outlined text-[22px] text-white">cameraswitch</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleCameraTorch}
                    disabled={!cameraTorchSupported && !cameraTorchOn}
                    className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-sm ${(!cameraTorchSupported && !cameraTorchOn) ? 'opacity-50' : ''}`}
                    aria-label="플래시"
                    title={!cameraTorchSupported ? '이 기기에서는 플래시를 지원하지 않을 수 있어요' : '플래시'}
                  >
                    <span className={`material-symbols-outlined text-[22px] ${cameraTorchOn ? 'text-primary' : 'text-white'}`}>bolt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCameraCapture(false)}
                    className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-sm"
                    aria-label="닫기"
                  >
                    <span className="material-symbols-outlined text-[22px] text-white">close</span>
                  </button>
                </div>
              </div>

              {/* 하단: 셔터만 (LiveJourney 톤: 라이트 링 + 메인컬러) */}
              <div
                className="absolute left-0 right-0 bottom-0 flex items-center justify-center"
                style={{ paddingBottom: 'calc(22px + env(safe-area-inset-bottom, 0px))' }}
              >
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="pointer-events-auto relative flex h-[84px] w-[84px] items-center justify-center"
                  aria-label="촬영"
                >
                  <div className="absolute inset-0 rounded-full bg-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)]" />
                  <div className="absolute inset-[7px] rounded-full bg-black/65 backdrop-blur-sm ring-1 ring-white/10" />
                  <div className="absolute inset-[14px] rounded-full bg-primary shadow-[0_0_22px_rgba(0,188,212,0.55)]" />
                </button>
              </div>
            </div>
          </div>
        )}

        {showPhotoOptions && (
          <div
            className="absolute inset-0 bg-black/50 z-[60] flex flex-col justify-end"
            onClick={() => setShowPhotoOptions(false)}
            style={{ bottom: 0 }}
          >
            <div
              className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ marginBottom: '80px', maxWidth: '100%' }}
            >
              <h3 className="text-lg font-bold text-center mb-4">사진 또는 동영상 선택</h3>
              <button
                onClick={() => handlePhotoOptionSelect('camera')}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-subtle-light dark:border-subtle-dark rounded-lg h-14 px-4 text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span>촬영하기</span>
              </button>
              <button
                onClick={() => handlePhotoOptionSelect('gallery')}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-subtle-light dark:border-subtle-dark rounded-lg h-14 px-4 text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span>갤러리에서 선택하기</span>
              </button>
            </div>
            {/* 취소 버튼 - 네비게이션 바 위치 */}
            <button
              onClick={() => setShowPhotoOptions(false)}
              className="absolute bottom-0 left-0 right-0 w-full flex items-center justify-center bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 h-20 px-4 text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors z-[61]"
              style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
              }}
            >
              취소
            </button>
          </div>
        )}

        {showSuccessModal && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
            <div className="w-full max-w-sm transform flex-col rounded-xl bg-white dark:bg-[#221910] p-6 shadow-2xl transition-all">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
                    <span className="text-green-600 dark:text-green-400 text-5xl">
                      ✓
                    </span>
                  </div>
                  <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping"></div>
                </div>
              </div>

              <h1 className="text-[#181411] dark:text-gray-100 text-[22px] font-bold leading-tight tracking-[-0.015em] text-center pb-2">
                업로드 완료!
              </h1>

              <p className="text-gray-700 dark:text-gray-300 text-base font-normal leading-normal pb-4 text-center">
                여행 기록이 성공적으로 업로드되었습니다
              </p>

              {uploadProgress < 100 ? (
                <div className="mt-2">
                  <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                    업로드 중.. {uploadProgress}%
                  </p>
                </div>
              ) : (
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-2">
                  잠시 후 메인 화면으로 이동합니다...
                </p>
              )}
            </div>
          </div>
        )}

        {showBadgeModal && earnedBadge && (
          <div key={badgeAnimationKey} className="absolute inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 animate-fade-in">
            <div className="w-full max-w-sm transform rounded-3xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-zinc-800 dark:to-zinc-900 p-8 shadow-2xl border-4 border-primary animate-scale-up">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary via-primary to-accent shadow-2xl">
                    <span className="text-6xl">{earnedBadge.icon || '🏆'}</span>
                  </div>
                  <div className="absolute inset-0 rounded-full bg-yellow-400/40 animate-ping"></div>
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-xl animate-bounce">
                    NEW!
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-center mb-3 text-zinc-900 dark:text-white">
                축하합니다!
              </h1>

              <p className="text-xl font-bold text-center text-primary mb-2">
                {earnedBadge.name || earnedBadge}
              </p>

              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${earnedBadge.difficulty === '상' ? 'bg-primary-dark text-white' :
                  earnedBadge.difficulty === '중' ? 'bg-blue-500 text-white' :
                    'bg-green-500 text-white'
                  }`}>
                  난이도: {earnedBadge.difficulty || '하'}
                </div>
              </div>

              <p className="text-base font-medium text-center text-zinc-700 dark:text-zinc-300 mb-6">
                뱃지를 획득했습니다!
              </p>

              <p className="text-sm text-center text-zinc-600 dark:text-zinc-400 mb-8">
                {earnedBadge.description || '여행 기록을 계속 쌓아가며 더 많은 뱃지를 획득해보세요!'}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    logger.debug('Navigate to profile');
                    setShowBadgeModal(false);
                    setShowSuccessModal(false);
                    navigate('/profile');
                  }}
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                >
                  내 프로필에서 확인하기
                </button>
                <button
                  onClick={() => {
                    logger.debug('Navigate to main');
                    setShowBadgeModal(false);
                    setShowSuccessModal(false);
                    navigate('/main');
                  }}
                  className="w-full bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 py-4 rounded-xl font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all transform hover:scale-105 active:scale-95"
                >
                  메인으로 가기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UploadScreen;










































