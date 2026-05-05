import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { uploadImage, uploadMetaToExifShape } from '../api/upload';
import { createPostSupabase, fetchPostByIdSupabase, getMergedMyPostsForStats, mapSupabasePostRowToPost, updatePostSupabase } from '../api/postsSupabase';
import { useAuth } from '../contexts/AuthContext';
import { notifyBadge } from '../utils/notifications';
import { checkNewBadges, awardBadge, hasSeenBadge, markBadgeAsSeen, calculateUserStats, getBadgeDisplayName } from '../utils/badgeSystem';
import { checkAndNotifyInterestPlace } from '../utils/interestPlaces';
import { getPartitionedUploadTags, getRecommendedTags } from '../utils/aiImageAnalyzer';
import { resolveDisplayLocationFromKakaoCoordResult } from '../utils/locationFromGeocode';
import { gainExp } from '../utils/levelSystem';
import { getBadgeCongratulationMessage, getBadgeDifficultyEffects } from '../utils/badgeMessages';
import { logger } from '../utils/logger';
import { useExifConsent } from '../contexts/ExifConsentContext';
import { convertGpsToAddress, extractExifData, isExifCaptureTooOldForUpload } from '../utils/exifExtractor';
import { getWeatherByRegion } from '../api/weather';
import { resolveRegionFromLocationInput } from '../utils/regionLocationMapping';
import { useLoginGate } from '../hooks/useLoginGate';

const formatUploadDateLine = (raw) => {
  const d = raw ? new Date(raw) : null;
  const dt = d && !Number.isNaN(d.getTime()) ? d : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
};
const UploadScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editIdParam } = useParams();
  const { user } = useAuth();
  const requireLogin = useLoginGate();
  const { exifAllowed } = useExifConsent();
  const isEditMode = useMemo(() => {
    const path = String(location?.pathname || '');
    return Boolean(editIdParam) && path.includes('/post/') && path.endsWith('/edit');
  }, [location?.pathname, editIdParam]);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [formData, setFormData] = useState({
    images: [],
    imageFiles: [],
    videos: [],
    videoFiles: [],
    location: '',
    tags: [],
    note: '',
    coordinates: null,
    aiCategory: 'scenic',
    aiCategoryName: '추천 장소',
    aiCategoryIcon: '📍'
  });
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [autoTags, setAutoTags] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingAITags, setLoadingAITags] = useState(false);
  const [exifExtracting, setExifExtracting] = useState(false);
  const [uploadExifBadge, setUploadExifBadge] = useState(null); // 'LIVE' | 'VERIFIED' | null
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [earnedBadge, setEarnedBadge] = useState(null);
  /** 미디어를 모두 지우기 전까지 AI 자동 태그는 최초 1회만 */
  const initialAiSuggestDoneRef = useRef(null);
  const noteAreaRef = useRef(null);

  // 수정 모드: 기존 게시물 로드 → 폼 초기화
  useEffect(() => {
    if (!isEditMode) return;
    if (!editIdParam) return;
    if (!requireLogin('수정')) return;

    let cancelled = false;
    (async () => {
      try {
        const pid = String(editIdParam || '').trim();
        const passed = location?.state?.post || null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
        if (!isUuid) {
          alert('이 게시물은 수정할 수 없습니다. (로컬 게시물)');
          navigate(-1);
          return;
        }
        const fresh = passed?.id === pid ? passed : await fetchPostByIdSupabase(pid, user?.id || null);
        if (cancelled) return;
        if (!fresh) {
          alert('게시물을 불러올 수 없습니다.');
          navigate(-1);
          return;
        }

        // 이미지/동영상은 "기존 URL 유지"가 기본이며, 새 파일을 추가하면 그때만 업로드
        const images = Array.isArray(fresh.images) ? fresh.images : (fresh.image ? [fresh.image] : []);
        const videos = Array.isArray(fresh.videos) ? fresh.videos : [];
        const tags = Array.isArray(fresh.tags) ? fresh.tags.map((t) => (typeof t === 'string' ? (t.startsWith('#') ? t : `#${t}`) : String(t || ''))) : [];

        setFormData((prev) => ({
          ...prev,
          images: images.filter(Boolean),
          videos: videos.filter(Boolean),
          imageFiles: [],
          videoFiles: [],
          location: fresh.location?.name || fresh.location || fresh.placeName || prev.location || '',
          tags,
          note: fresh.note || fresh.content || '',
          coordinates: fresh.coordinates || prev.coordinates || null,
          aiCategory: fresh.category || prev.aiCategory || 'scenic',
          aiCategoryName: fresh.categoryName || prev.aiCategoryName || '추천 장소',
          aiCategoryIcon: fresh.categoryIcon || prev.aiCategoryIcon || '📍',
          photoDate: fresh.photoDate || null,
          exifData: fresh.exifData || null,
          verifiedLocation: fresh.verifiedLocation || null,
          address: fresh.address || null,
          detailedLocation: fresh.detailedLocation || fresh.placeName || null,
        }));
      } catch (e) {
        logger.error('수정 화면 초기화 실패:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, editIdParam, location?.state, user?.id, navigate, requireLogin]);

  // 업로드 화면 날짜 표시: EXIF 촬영일 우선, 없으면 오늘 날짜
  const displayDateLine = useMemo(() => {
    const preferred = formData?.exifData?.photoDate || formData?.photoDate || null;
    return formatUploadDateLine(preferred || Date.now());
  }, [formData?.exifData?.photoDate, formData?.photoDate]);

  const computeUploadExifBadge = useCallback((photoDateIso) => {
    if (!photoDateIso) return null;
    const t = new Date(photoDateIso).getTime();
    if (!Number.isFinite(t)) return null;
    const diff = Date.now() - t;
    if (!Number.isFinite(diff) || diff < 0) return null;
    // photoStatus.ts와 동일 기준: 3시간 이내 LIVE, 30시간 이내 VERIFIED
    if (diff <= 3 * 60 * 60 * 1000) return 'LIVE';
    if (diff <= 30 * 60 * 60 * 1000) return 'VERIFIED';
    return null;
  }, []);

  const applyExtractedExifToForm = useCallback(async (exifFirst, sourceFile) => {
    if (!exifFirst) return;
    const f = sourceFile;
    const exifFileKey = f ? `${f.name}:${f.size}:${f.lastModified}` : '';

    // 48시간 초과 촬영본은 "실시간 인증" 배지 대상이 아님 + 사용자 선택권 제공
    if (exifFirst?.photoDate && !exifFirst?.oldCapture) {
      try {
        const ageMs = Date.now() - new Date(exifFirst.photoDate).getTime();
        const isOld = Number.isFinite(ageMs) && ageMs > 48 * 60 * 60 * 1000;
        if (isOld) {
          const ok = window.confirm("이 사진은 시간이 조금 지났네요! '실시간 인증' 배지를 받을 수 없지만 업로드할까요?");
          if (!ok) return;
          exifFirst.oldCapture = true;
          const ageHours = Math.max(0, ageMs / (60 * 60 * 1000));
          exifFirst.oldCaptureAgeHours = Math.round(ageHours * 10) / 10;
        }
      } catch {
        // ignore
      }
    }

    setUploadExifBadge(exifFirst?.oldCapture ? null : computeUploadExifBadge(exifFirst?.photoDate || null));

    setFormData((prev) => ({
      ...prev,
      photoDate: exifFirst?.photoDate || prev.photoDate,
      exifData: exifFirst ? { ...exifFirst } : prev.exifData,
      prefetchedExif: exifFirst && exifFileKey
        ? { fileKey: exifFileKey, exif: { photoDate: exifFirst.photoDate, dateTimeOriginalRaw: exifFirst.dateTimeOriginalRaw } }
        : prev.prefetchedExif,
    }));

    // EXIF GPS가 있으면 그 위치를 우선 사용 (처음 1회만)
    if (exifFirst?.gpsCoordinates?.lat != null && exifFirst?.gpsCoordinates?.lng != null) {
      const lat = Number(exifFirst.gpsCoordinates.lat);
      const lng = Number(exifFirst.gpsCoordinates.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const exifLoc = await convertGpsToAddress(lat, lng);
        setFormData((prev) => ({
          ...prev,
          // ✅ 동의 후 재추출에서도 사진 위치를 최우선으로 반영
          location: exifLoc || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          coordinates: { lat, lng },
          verifiedLocation: exifLoc || prev.verifiedLocation || null,
        }));
      }
    }
  }, [computeUploadExifBadge]);

  const growNoteArea = useCallback(() => {
    const el = noteAreaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(Math.max(el.scrollHeight, 76), 280);
    el.style.height = `${next}px`;
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
          void (async () => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
              const row = result[0];
              const address = row.address;
              const roadAddress = row.road_address;
              const detailedAddress = roadAddress?.address_name || address?.address_name || '';
              const locationName = await resolveDisplayLocationFromKakaoCoordResult(row, longitude, latitude);

              setFormData((prev) => ({
                ...prev,
                location: locationName || prev.location,
                coordinates: { lat: latitude, lng: longitude },
                address: detailedAddress,
                detailedLocation: locationName || detailedAddress,
              }));
            } else {
              setFormData((prev) => ({
                ...prev,
                location: prev.location || '서울',
                coordinates: { lat: latitude, lng: longitude },
              }));
            }
            setLoadingLocation(false);
          })();
        });
      } else {
        setFormData(prev => ({
          ...prev,
          location: '서울',
          coordinates: { lat: latitude, lng: longitude }
        }));
        setLoadingLocation(false);
      }
    } catch (error) {
      logger.error('위치 감지 실패:', error);
      setLoadingLocation(false);
    }
  }, []);

  const analyzeImageAndGenerateTags = useCallback(async (file, location = '', note = '') => {
    // 사진 파일이 없으면 분석하지 않음
    if (!file) {
      setAutoTags([]);
      return;
    }
    
    setLoadingAITags(true);
    try {
      const analysisResult = await getPartitionedUploadTags(file, location, note);
      
      if (analysisResult.success && analysisResult.tags && analysisResult.tags.length > 0) {
        const limitedTags = analysisResult.tags.slice(0, 6);
        
        // 현재 등록된 태그 목록 가져오기 (# 제거하여 비교)
        const existingTags = formData.tags.map(tag => 
          tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase()
        );
        
        // 이미 등록된 태그는 제외하고, 한국어 태그만 필터링
        const filteredTags = limitedTags
          .filter(tag => {
            const tagWithoutHash = tag.startsWith('#') ? tag.substring(1) : tag;
            const tagLower = tagWithoutHash.toLowerCase();
            // 이미 등록된 태그가 아닌지 확인
            const notExists = !existingTags.includes(tagLower);
            // 한국어인지 확인 (한글, 공백, 숫자만 허용)
            const isKorean = /^[가-힣\s\d]+$/.test(tagWithoutHash);
            return notExists && isKorean;
          })
          .slice(0, 6);
        
        const hashtagged = filteredTags.map(tag => 
          tag.startsWith('#') ? tag : `#${tag}`
        );
        
        setAutoTags(hashtagged);
        setFormData(prev => ({
          ...prev,
          aiCategory: analysisResult.category,
          aiCategoryName: analysisResult.categoryName,
          aiCategoryIcon: analysisResult.categoryIcon
        }));
        
      } else {
        // 분석 실패 시 날씨 중심 기본 태그 제공 (5개)
        const existingTags = formData.tags.map(tag => 
          tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase()
        );
        const currentMonth = new Date().getMonth() + 1;
        let defaultTags = [];
        
        const locTok =
          String(location || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .pop() || '여행';
        const locTag = /^[가-힣]/.test(locTok) ? locTok.replace(/[^가-힣0-9]/g, '') || '여행' : '여행';
        if (currentMonth >= 3 && currentMonth <= 5) {
          defaultTags = ['맑은날씨', '화창한날씨', locTag, '평화로운', '낭만적인', '힐링'];
        } else if (currentMonth >= 6 && currentMonth <= 8) {
          defaultTags = ['여름날씨', '청명한날씨', locTag, '시원한', '청량한', '활기찬'];
        } else if (currentMonth >= 9 && currentMonth <= 11) {
          defaultTags = ['가을날씨', '쾌청한날씨', locTag, '고즈넉한', '차분한', '낭만적인'];
        } else {
          defaultTags = ['겨울날씨', '맑은날씨', locTag, '포근한', '편안한', '고요한'];
        }
        
        const filteredTags = defaultTags
          .filter(tag => {
            const tagLower = tag.toLowerCase();
            return !existingTags.includes(tagLower);
          })
          .slice(0, 6);
        
        setAutoTags(filteredTags.map(tag => `#${tag}`));
        
        setFormData(prev => ({
          ...prev,
          aiCategory: 'scenic',
          aiCategoryName: '추천 장소',
          aiCategoryIcon: '📍'
        }));
      }
      
    } catch (error) {
      logger.error('AI 분석 실패:', error);
      // 에러 발생 시에도 날씨 중심 기본 태그 제공 (5개)
      const existingTags = formData.tags.map(tag => 
        tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase()
      );
      const currentMonth = new Date().getMonth() + 1;
      let defaultTags = [];
      
      const locTok2 =
        String(location || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .pop() || '여행';
      const locTag2 = /^[가-힣]/.test(locTok2) ? locTok2.replace(/[^가-힣0-9]/g, '') || '여행' : '여행';
      if (currentMonth >= 3 && currentMonth <= 5) {
        defaultTags = ['맑은날씨', '화창한날씨', locTag2, '평화로운', '낭만적인', '힐링'];
      } else if (currentMonth >= 6 && currentMonth <= 8) {
        defaultTags = ['여름날씨', '청명한날씨', locTag2, '시원한', '청량한', '활기찬'];
      } else if (currentMonth >= 9 && currentMonth <= 11) {
        defaultTags = ['가을날씨', '쾌청한날씨', locTag2, '고즈넉한', '차분한', '낭만적인'];
      } else {
        defaultTags = ['겨울날씨', '맑은날씨', locTag2, '포근한', '편안한', '고요한'];
      }
      
      const filteredTags = defaultTags
        .filter(tag => !existingTags.includes(tag.toLowerCase()))
        .slice(0, 6);
      
      setAutoTags(filteredTags.map(tag => `#${tag}`));
      
      setFormData(prev => ({
        ...prev,
        aiCategory: 'scenic',
        aiCategoryName: '추천 장소',
        aiCategoryIcon: '📍'
      }));
    } finally {
      setLoadingAITags(false);
    }
  }, [formData.location, formData.note, formData.tags]);

  const handleImageSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const MAX_SIZE = 50 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 동영상은 100MB까지
    
    const imageFiles = [];
    const videoFiles = [];
    
    files.forEach(file => {
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_SIZE;
      
      if (file.size > maxSize) {
        alert(`${file.name}은(는) ${isVideo ? '100MB' : '50MB'}를 초과합니다`);
        return;
      }
      
      if (isVideo) {
        videoFiles.push(file);
      } else {
        imageFiles.push(file);
      }
    });

    // EXIF: 첫 사진/동영상에서 촬영 시각·위치(동영상은 QuickTime/MP4 메타 + mvhd)
    let exifFirst = null;
    let exifFileKey = '';
    if (exifAllowed && (imageFiles.length > 0 || videoFiles.length > 0)) {
      setExifExtracting(true);
      try {
        const runOldCaptureDialog = (f, ex) => {
          if (!ex?.photoDate) return true;
          const isVid = String(f?.type || '').toLowerCase().startsWith('video/');
          if (isExifCaptureTooOldForUpload(ex.photoDate, { isInAppCamera: false, hasOnlyVideo: isVid })) {
            const ok = window.confirm(
              isVid
                ? "이 동영상은 시간이 조금 지났네요! '실시간 인증' 배지를 받을 수 없지만 업로드할까요?"
                : "이 사진은 시간이 조금 지났네요! '실시간 인증' 배지를 받을 수 없지만 업로드할까요?",
            );
            if (!ok) return false;
            try {
              const ageMs = Date.now() - new Date(ex.photoDate).getTime();
              const ageHours = Number.isFinite(ageMs) ? Math.max(0, ageMs / (60 * 60 * 1000)) : null;
              ex.oldCapture = true;
              if (ageHours != null) ex.oldCaptureAgeHours = Math.round(ageHours * 10) / 10;
            } catch {
              ex.oldCapture = true;
            }
          }
          return true;
        };

        for (let i = 0; i < imageFiles.length; i += 1) {
          const f = imageFiles[i];
          const ex = await extractExifData(f, { allowed: true });
          if (ex?.photoDate && !runOldCaptureDialog(f, ex)) {
            imageFiles.splice(i, 1);
            i -= 1;
            continue;
          }
          if (ex) {
            exifFirst = ex;
            exifFileKey = `${f.name}:${f.size}:${f.lastModified}`;
            break;
          }
        }

        if (!exifFirst && videoFiles.length > 0) {
          for (let i = 0; i < videoFiles.length; i += 1) {
            const f = videoFiles[i];
            const ex = await extractExifData(f, { allowed: true });
            if (ex?.photoDate && !runOldCaptureDialog(f, ex)) {
              videoFiles.splice(i, 1);
              i -= 1;
              continue;
            }
            if (ex) {
              exifFirst = ex;
              exifFileKey = `${f.name}:${f.size}:${f.lastModified}`;
              break;
            }
          }
        }
      } catch (err) {
        logger.warn('EXIF 추출 실패(무시):', err);
      } finally {
        setExifExtracting(false);
      }
    }

    const imageUrls = imageFiles.map(file => URL.createObjectURL(file));
    const videoUrls = videoFiles.map(file => URL.createObjectURL(file));
    const isFirstMedia = formData.images.length === 0 && formData.videos.length === 0;
    
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...imageUrls],
      imageFiles: [...prev.imageFiles, ...imageFiles],
      videos: [...prev.videos, ...videoUrls],
      videoFiles: [...prev.videoFiles, ...videoFiles],
      photoDate: exifFirst?.photoDate || prev.photoDate,
      exifData: exifFirst ? { ...exifFirst } : prev.exifData,
      prefetchedExif: exifFirst
        ? { fileKey: exifFileKey, exif: { photoDate: exifFirst.photoDate, dateTimeOriginalRaw: exifFirst.dateTimeOriginalRaw } }
        : prev.prefetchedExif,
    }));

    setUploadExifBadge(exifFirst?.oldCapture ? null : computeUploadExifBadge(exifFirst?.photoDate || null));

    if (isFirstMedia && (imageFiles.length > 0 || videoFiles.length > 0)) {
      // ✅ 사진 EXIF GPS가 있으면 "그 위치"를 최우선으로 위치 입력칸에 반영
      // - 업로드 시 "내 위치 자동 입력"은 하지 않음 (사용자가 버튼으로만 선택)
      if (exifFirst?.gpsCoordinates?.lat != null && exifFirst?.gpsCoordinates?.lng != null) {
        const lat = Number(exifFirst.gpsCoordinates.lat);
        const lng = Number(exifFirst.gpsCoordinates.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          void (async () => {
            const exifLoc = await convertGpsToAddress(lat, lng);
            const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setFormData((prev) => ({
              ...prev,
              location: exifLoc || fallback,
              coordinates: { lat, lng },
              verifiedLocation: exifLoc || prev.verifiedLocation || null,
            }));
          })();
        }
      }
      const firstMediaFile = imageFiles[0] || videoFiles[0];
      const mediaKey = firstMediaFile
        ? `${firstMediaFile.name}:${firstMediaFile.size}:${firstMediaFile.lastModified}`
        : '';
      if (firstMediaFile && mediaKey && initialAiSuggestDoneRef.current !== mediaKey) {
        initialAiSuggestDoneRef.current = mediaKey;
        analyzeImageAndGenerateTags(firstMediaFile, formData.location, formData.note);
      }
    }
  }, [formData.images.length, formData.videos.length, formData.location, formData.note, exifAllowed, getCurrentLocation, analyzeImageAndGenerateTags]);

  // ✅ 동의가 "나중에" 완료된 경우(첫 진입 모달 등): 이미 선택된 첫 사진에 대해 EXIF를 즉시 재추출
  useEffect(() => {
    const first = formData.imageFiles?.[0] || formData.videoFiles?.[0] || null;
    if (!first) return;
    if (!exifAllowed) return;
    if (exifExtracting) return;
    const hasMeaningful = Boolean(
      formData?.exifData &&
        (formData.exifData.photoDate ||
          (formData.exifData.gpsCoordinates &&
            Number.isFinite(Number(formData.exifData.gpsCoordinates.lat)) &&
            Number.isFinite(Number(formData.exifData.gpsCoordinates.lng)))),
    );
    if (hasMeaningful) return;

    let cancelled = false;
    setExifExtracting(true);
    (async () => {
      try {
        const ex = await extractExifData(first, { allowed: true });
        if (cancelled || !ex) return;
        if (ex?.photoDate && isExifCaptureTooOldForUpload(ex.photoDate, { isInAppCamera: false, hasOnlyVideo: false })) {
          return;
        }
        await applyExtractedExifToForm(ex, first);
      } catch (e) {
        logger.warn('EXIF 재추출 실패(무시):', e?.message || e);
      } finally {
        if (!cancelled) setExifExtracting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exifAllowed, formData.imageFiles, formData.videoFiles, formData.exifData, exifExtracting, applyExtractedExifToForm]);

  useEffect(() => {
    if (formData.imageFiles.length === 0 && formData.videoFiles.length === 0) {
      initialAiSuggestDoneRef.current = null;
      setUploadExifBadge(null);
    }
  }, [formData.imageFiles.length, formData.videoFiles.length]);

  useEffect(() => {
    growNoteArea();
  }, [formData.note, growNoteArea]);

  // 태그가 변경될 때마다 자동 태그에서 이미 등록된 태그 제거
  useEffect(() => {
    if (autoTags.length > 0 && formData.tags.length > 0) {
      const existingTags = formData.tags.map(tag => 
        tag.replace('#', '').toLowerCase()
      );
      
      setAutoTags(prev => prev.filter(tag => {
        const tagClean = tag.replace('#', '').toLowerCase();
        return !existingTags.includes(tagClean);
      }));
    }
  }, [formData.tags]);

  const requestAiTagSuggestion = useCallback(() => {
    const f = formData.imageFiles[0] || formData.videoFiles[0];
    if (!f) {
      alert('태그 추천을 받으려면 사진 또는 동영상을 먼저 추가해 주세요.');
      return;
    }
    analyzeImageAndGenerateTags(f, formData.location, formData.note);
  }, [formData.imageFiles, formData.videoFiles, formData.location, formData.note, analyzeImageAndGenerateTags]);

  const handlePhotoOptionSelect = useCallback((option) => {
    setShowPhotoOptions(false);
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    
    if (option === 'camera') {
      input.capture = 'environment';
    }
    
    input.onchange = handleImageSelect;
    input.click();
  }, [handleImageSelect]);

  const addTag = useCallback(() => {
    if (tagInput.trim() && !formData.tags.includes(`#${tagInput.trim()}`)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, `#${tagInput.trim()}`]
      }));
      setTagInput('');
    }
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
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentUser = user || savedUser;
      const currentUserId = currentUser?.id || savedUser?.id || null;
      const uid = currentUserId != null ? String(currentUserId).trim() : '';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);

      let myPosts = [];
      if (isUuid) {
        try {
          myPosts = await getMergedMyPostsForStats(uid);
        } catch (e) {
          logger.warn('Supabase 내 게시물 조회 실패(뱃지 통계):', e?.message);
        }
      }
      
      logger.log(`📊 사용자 통계 계산 중... (총 ${myPosts.length}개 게시물)`);
      
      // 통계 계산
      const stats = calculateUserStats(myPosts, currentUser);
      
      logger.debug('📈 계산된 통계:', {
        totalPosts: stats.totalPosts,
        totalLikes: stats.totalLikes,
        visitedRegions: stats.visitedRegions
      });
      
      // 뱃지 체크 (통계 전달!)
      const newBadges = checkNewBadges(stats);
      logger.log(`📋 발견된 새 뱃지: ${newBadges.length}개`);
      
      if (newBadges.length > 0) {
        // 모든 새 뱃지 획득 처리
        let awardedCount = 0;
        
        newBadges.forEach((badge, index) => {
          logger.log(`\n🎯 뱃지 ${index + 1}/${newBadges.length} 처리 중: ${badge.name}`);
          logger.debug(`   난이도: ${badge.difficulty}`);
          logger.debug(`   설명: ${badge.description}`);
          
          const awarded = awardBadge(badge);
          
          if (awarded) {
            awardedCount++;
            logger.log(`   ✅ 뱃지 획득 성공: ${badge.name}`);
            
            // 첫 번째 뱃지만 모달 표시
            if (index === 0) {
              notifyBadge(badge.name, badge.difficulty);
              logger.log('   📢 알림 전송 완료');
              
              setEarnedBadge(badge);
              setShowBadgeModal(true);
              logger.log('   🎉 뱃지 모달 표시');
              
              gainExp(`뱃지 획득 (${badge.difficulty})`);
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
  }, [user]);

  const handleSubmit = useCallback(async () => {
    logger.log('Upload started!');
    logger.debug('Image count:', formData.images.length);
    logger.debug('Location:', formData.location);

    if (!requireLogin(isEditMode ? '수정' : '업로드')) return;
    
    if (formData.images.length === 0 && formData.videos.length === 0) {
      alert('사진 또는 동영상을 추가해주세요');
      return;
    }

    if (!formData.location.trim()) {
      alert('위치를 입력해주세요');
      return;
    }

    if (!String(formData.note || '').trim()) {
      alert('이 순간의 이야기를 입력해 주세요.');
      return;
    }

    // 촬영시간(EXIF) 48시간 초과 업로드는 "선택권"으로 허용 (배지/노출/점수에서 불리)

    logger.log('Validation passed - proceeding with upload');

    try {
      setUploading(true);
      setUploadProgress(10);
      
      const uploadedImageUrls = [];
      const uploadedVideoUrls = [];
      let exifRecoveredFromUpload = null;
      
      const aiCategory = formData.aiCategory || 'scenic';
      const aiCategoryName = formData.aiCategoryName || '추천 장소';

      logger.debug('AI category:', aiCategoryName);
      
      const totalFiles = formData.imageFiles.length + formData.videoFiles.length;
      let uploadedCount = 0;
      
      // 이미지 업로드
      if (formData.imageFiles.length > 0) {
        for (let i = 0; i < formData.imageFiles.length; i++) {
          const file = formData.imageFiles[i];
          uploadedCount++;
          setUploadProgress(20 + (uploadedCount * 40 / totalFiles));
          
          try {
            const uploadResult = await uploadImage(file);
            if (uploadResult.success && uploadResult.url) {
              uploadedImageUrls.push(uploadResult.url);
              if (!exifRecoveredFromUpload && uploadResult.meta) {
                const shaped = uploadMetaToExifShape(uploadResult.meta);
                if (shaped) exifRecoveredFromUpload = shaped;
              }
            }
          } catch (uploadError) {
            logger.warn('이미지 업로드 실패:', uploadError?.message || uploadError);
          }
        }
      }
      
      // 동영상 업로드 (동일한 uploadImage 함수 사용, 백엔드에서 처리)
      if (formData.videoFiles.length > 0) {
        for (let i = 0; i < formData.videoFiles.length; i++) {
          const file = formData.videoFiles[i];
          uploadedCount++;
          setUploadProgress(20 + (uploadedCount * 40 / totalFiles));
          
          try {
            const uploadResult = await uploadImage(file);
            if (uploadResult.success && uploadResult.url) {
              uploadedVideoUrls.push(uploadResult.url);
            }
          } catch (uploadError) {
            logger.warn('동영상 업로드 실패:', uploadError?.message || uploadError);
          }
        }
      }
      
      setUploadProgress(60);

      const toHttpsPersistent = (u) => {
        if (typeof u !== 'string' || !u.trim()) return null;
        let t = u.trim();
        if (t.startsWith('http://') && /\.supabase\.co/i.test(t)) t = t.replace(/^http:/i, 'https:');
        return t.startsWith('https://') ? t : null;
      };

      const finalImages = uploadedImageUrls.map(toHttpsPersistent).filter(Boolean);
      const finalVideos = uploadedVideoUrls.map(toHttpsPersistent).filter(Boolean);

      // 수정 모드: 기존 URL을 유지하고, 새로 업로드된 URL만 추가한다.
      const existingImages = (isEditMode ? (Array.isArray(formData.images) ? formData.images : []) : [])
        .map(toHttpsPersistent)
        .filter(Boolean);
      const existingVideos = (isEditMode ? (Array.isArray(formData.videos) ? formData.videos : []) : [])
        .map(toHttpsPersistent)
        .filter(Boolean);
      const mergedImages = Array.from(new Set([...existingImages, ...finalImages]));
      const mergedVideos = Array.from(new Set([...existingVideos, ...finalVideos]));

      logger.log('📸 업로드된 미디어 URL(Supabase https만 DB 저장):', {
        images: finalImages.length,
        videos: finalVideos.length,
      });

      if (mergedImages.length === 0 && mergedVideos.length === 0) {
        alert(
          '미디어가 서버에 올라가지 않았습니다. Supabase Storage·환경 변수·로그인을 확인해 주세요.\n(https 주소만 저장됩니다)'
        );
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      setUploadProgress(78);

      const hasMeaningfulPrefetchedExif = Boolean(
        formData.exifData &&
          (formData.exifData.photoDate ||
            (formData.exifData.gpsCoordinates &&
              Number.isFinite(Number(formData.exifData.gpsCoordinates.lat)) &&
              Number.isFinite(Number(formData.exifData.gpsCoordinates.lng)))),
      );
      const effectiveExif = hasMeaningfulPrefetchedExif ? formData.exifData : exifRecoveredFromUpload || formData.exifData;

      // effectiveExif가 오래된 촬영본이어도 업로드는 허용

      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentUser = user || savedUser;
      const username = currentUser?.username || currentUser?.email?.split('@')[0] || '모사모';
      const rawId = currentUser?.id || savedUser?.id || null;
      const uid = rawId != null ? String(rawId).trim() : '';
      const userIdForDb = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid) ? uid : null;

      const region = resolveRegionFromLocationInput(formData.location) || '기타';

      // 촬영 시각(EXIF) 기준 기온을 posts.weather(jsonb)에 스냅샷으로 저장.
      // - 상세 화면은 이 값을 고정 표시(실시간 재조회 없음)
      // - 실패해도 업로드는 계속 진행
      let weatherSnapshot = null;
      try {
        const fixedAt = effectiveExif?.photoDate || null;
        const w = await getWeatherByRegion(region, false, fixedAt ? { at: fixedAt } : {});
        if (w?.success && w?.weather) {
          weatherSnapshot = {
            ...w.weather,
            observedAt: fixedAt || new Date().toISOString(),
            source: 'kma_ultra_ncst',
          };
        }
      } catch (e) {
        logger.warn('업로드 시점 날씨 스냅샷 실패:', e?.message || e);
      }

      const supResult = isEditMode
        ? await updatePostSupabase(String(editIdParam || ''), {
            content: formData.note,
            location: formData.location,
            detailed_location: formData.location,
            place_name: formData.location,
            region,
            tags: formData.tags,
            images: mergedImages,
            videos: mergedVideos,
            // 날씨 스냅샷은 수정 시에도 갱신 허용(선택)
            weather: weatherSnapshot ?? undefined,
          })
        : await createPostSupabase({
            userId: userIdForDb,
            user:
              userIdForDb && currentUser && typeof currentUser === 'object'
                ? {
                    id: userIdForDb,
                    username,
                    profileImage: currentUser.profileImage || currentUser.avatar_url || null,
                  }
                : { username },
            note: formData.note,
            content: formData.note,
            images: mergedImages,
            videos: mergedVideos,
            location: formData.location,
            detailedLocation: formData.location,
            placeName: formData.location,
            region,
            tags: formData.tags,
            category: aiCategory,
            categoryName: aiCategoryName,
            likes: 0,
            coordinates: formData.coordinates,
            photoDate: effectiveExif?.photoDate || null,
            exifData: effectiveExif || null,
            weatherSnapshot,
            createdAt: new Date().toISOString(),
            comments: [],
          });

      if (!supResult.success || !supResult.post) {
        const hint = supResult.hint || supResult.error || '알 수 없는 오류';
        logger.error('Supabase 게시물 저장 실패:', supResult);
        alert(`게시물을 저장하지 못했습니다.\n${typeof hint === 'string' ? hint : ''}`);
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      const uploadedPost = mapSupabasePostRowToPost(supResult.post);

      setUploadProgress(100);
      setShowSuccessModal(true);

      logger.log('Supabase 게시물 저장 완료:', uploadedPost.id);

      setTimeout(async () => {
        logger.log('🔔 관심 지역/장소 알림 체크 중...');
        await checkAndNotifyInterestPlace(uploadedPost);
      }, 200);

      setTimeout(() => {
        logger.log('📢 게시물 업데이트 이벤트 (Supabase)');
        window.dispatchEvent(new Event('newPostsAdded'));
        window.dispatchEvent(new Event('postsUpdated'));
      }, 100);

      // 수정은 뱃지/레벨 지급 흐름을 타지 않고 상세로 복귀
      if (isEditMode) {
        setTimeout(() => {
          window.dispatchEvent(new Event('postsUpdated'));
          setShowSuccessModal(false);
          navigate(`/post/${encodeURIComponent(String(uploadedPost.id))}`, { replace: true, state: { post: uploadedPost } });
        }, 550);
        return;
      }

      setTimeout(() => {
        void (async () => {
          logger.debug('Badge check timer running');
          const expResult = gainExp('사진 업로드');
          if (expResult.levelUp) {
            logger.log(`Level up! Lv.${expResult.newLevel}`);
            window.dispatchEvent(
              new CustomEvent('levelUp', {
                detail: { newLevel: expResult.newLevel },
              })
            );
          }
          logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          logger.log('🏆 뱃지 체크 시작');
          const earnedBadge = await checkAndAwardBadge();
          logger.debug('Badge earned result:', earnedBadge);
          logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          window.dispatchEvent(new Event('badgeProgressUpdated'));
          if (!earnedBadge) {
            logger.debug('Navigate to main in 2 seconds...');
            setTimeout(() => {
              setShowSuccessModal(false);
              navigate('/main');
            }, 2000);
          } else {
            logger.log('Badge earned! Showing badge modal...');
          }
        })();
      }, 800);
    } catch (error) {
      logger.error('Upload failed:', error);
      alert('업로드에 실패했습니다. 다시 시도해주세요');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [formData, user, navigate, checkAndAwardBadge, requireLogin, isEditMode, editIdParam]);

  const hasMedia = formData.images.length > 0 || formData.videos.length > 0;
  const noteFilled = String(formData.note || '').trim().length > 0;
  const canSubmit =
    !uploading && hasMedia && Boolean(formData.location.trim()) && noteFilled;

  return (
    <>
      <div className="phone-screen" style={{ 
        background: '#ffffff',
        borderRadius: '32px',
        overflow: 'hidden',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* 상태바 여백 (콘텐츠를 조금 더 위로) */}
        <div className="h-2 shrink-0" />
        
        {/* 앱 헤더 */}
        <header className="app-header" style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'transparent',
          color: '#111827'
        }}>
          <button 
            type="button"
            onClick={() => {
              if (location.state?.fromMap) {
                navigate('/main');
              } else {
                navigate(-1);
              }
            }}
            className="flex size-10 shrink-0 items-center justify-center text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="뒤로"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center px-1">
            <h1
              className="truncate text-center text-lg font-bold"
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#111827',
                fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              업로드: 여행 기록
            </h1>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate('/upload/guide', {
                state: { returnTo: `${location.pathname}${location.search || ''}` },
              })
            }
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"
            title="업로드 가이드"
            aria-label="업로드 가이드 전체 화면으로 보기"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">menu_book</span>
          </button>
        </header>

        {/* 앱 컨텐츠 */}
        <main className="app-content bg-white" style={{ 
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '100px',
          padding: '4px 16px 100px 16px',
          background: '#ffffff',
        }}>
          <div className="space-y-3 bg-white px-0 pt-0 pb-2">
            {(formData.images.length === 0 && formData.videos.length === 0) ? (
              <button
                type="button"
                onClick={() => setShowPhotoOptions(true)}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-subtle-light bg-white px-6 py-10 text-center transition-colors hover:border-primary dark:border-subtle-dark dark:bg-white"
              >
                <span className="material-symbols-outlined text-4xl text-primary">add_circle</span>
                <p className="text-base font-bold">사진 또는 동영상 추가</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">최대 10개까지</p>
              </button>
            ) : (
              <div className="-mx-1">
                <div 
                  className="flex gap-2 overflow-x-scroll overflow-y-hidden pb-2 px-1 snap-x snap-mandatory scroll-smooth cursor-grab active:cursor-grabbing select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" 
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'smooth'
                  }}
                  onMouseDown={(e) => {
                    // 버튼 클릭인 경우 드래그 방지
                    if (e.target.closest('button')) return;
                    
                    const slider = e.currentTarget;
                    let isDown = true;
                    let startX = e.pageX - slider.offsetLeft;
                    let scrollLeft = slider.scrollLeft;
                    slider.style.cursor = 'grabbing';

                    const handleMouseMove = (e) => {
                      if (!isDown) return;
                      e.preventDefault();
                      const x = e.pageX - slider.offsetLeft;
                      const walk = (x - startX) * 2;
                      slider.scrollLeft = scrollLeft - walk;
                    };

                    const handleMouseUp = () => {
                      isDown = false;
                      slider.style.cursor = 'grab';
                    };

                    const handleMouseLeave = () => {
                      isDown = false;
                      slider.style.cursor = 'grab';
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                    slider.addEventListener('mouseleave', handleMouseLeave);

                    // 한 번만 실행되도록 이벤트 제거 함수
                    const cleanup = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                      slider.removeEventListener('mouseleave', handleMouseLeave);
                      slider.removeEventListener('mouseup', cleanup);
                    };
                    
                    slider.addEventListener('mouseup', cleanup);
                  }}
                >
                  {/* 이미지들 */}
                  {formData.images.map((image, index) => (
                    <div key={`img-${index}`} className="relative w-24 h-24 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 snap-start">
                      <img 
                        src={image} 
                        alt={`preview-${index}`} 
                        className="w-full h-full object-contain" 
                      />
                      {/* 첫 이미지: EXIF 기반 LIVE/최근 인증 뱃지 */}
                      {index === 0 && uploadExifBadge && (
                        <div
                          className="absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                          style={{
                            background: uploadExifBadge === 'LIVE' ? 'rgba(14,165,233,0.92)' : 'rgba(148,163,184,0.92)',
                            color: '#fff',
                            boxShadow: '0 1px 6px rgba(15,23,42,0.14)',
                          }}
                        >
                          {uploadExifBadge === 'LIVE' ? '현장 LIVE' : '최근 인증'}
                        </div>
                      )}
                      {/* EXIF 추출 중 표시 */}
                      {index === 0 && exifAllowed && exifExtracting && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: 'rgba(15,23,42,0.18)' }}
                        >
                          <div className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold text-gray-700">
                            촬영정보 추출 중…
                          </div>
                        </div>
                      )}
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
                        className="absolute top-1 right-1 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-black/70 px-1.5 text-sm font-bold leading-none text-white hover:bg-black/90 z-10"
                        aria-label="미리보기 삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {/* 동영상들 */}
                  {formData.videos.map((video, index) => (
                    <div key={`vid-${index}`} className="relative w-24 h-24 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 snap-start">
                      <video 
                        src={video} 
                        className="w-full h-full object-contain"
                        muted
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white">동영상</span>
                      </div>
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
                        className="absolute top-1 right-1 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-black/70 px-1.5 text-sm font-bold leading-none text-white hover:bg-black/90 z-10"
                        aria-label="미리보기 삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {/* 추가 버튼 (최대 10개까지) */}
                  {(formData.images.length + formData.videos.length) < 10 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPhotoOptions(true);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-24 h-24 flex-shrink-0 rounded border-2 border-dashed border-subtle-light dark:border-subtle-dark flex items-center justify-center hover:border-primary transition-colors bg-gray-50 dark:bg-gray-800/50 snap-start z-10"
                    >
                      <span className="material-symbols-outlined text-xl text-primary">add</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="flex flex-col">
                <div className="flex items-center justify-between pb-2">
                  <p className="text-base font-medium text-gray-900">위치</p>
                  {loadingLocation && (
                    <span className="text-xs text-primary">위치 감지 중...</span>
                  )}
                </div>
                <div className="flex w-full flex-1 items-stretch gap-2">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-subtle-light dark:border-subtle-dark bg-background-light dark:bg-background-dark focus:border-primary focus:ring-0 h-12 p-3 text-sm font-normal placeholder:text-placeholder-light dark:placeholder:text-placeholder-dark"
                    placeholder="어디에서 찍은 사진인가요? (예: 서울 남산, 부산 해운대)"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={loadingLocation}
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-subtle-light bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 dark:border-subtle-dark dark:bg-primary/20 dark:hover:bg-primary/30"
                    title="현재 위치 자동 감지"
                    aria-label="현재 위치 자동 감지"
                  >
                    <span className="material-symbols-outlined text-[24px] leading-none">my_location</span>
                  </button>
                </div>
              </label>
            </div>

            <div>
              <label className="flex flex-col">
                <div className="flex items-center justify-between pb-2">
                  <p className="text-base font-medium text-gray-900">태그추가</p>
                </div>
                <div className="flex w-full items-stretch gap-2">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-subtle-light dark:border-subtle-dark bg-background-light dark:bg-background-dark focus:border-primary focus:ring-0 h-12 p-3 text-sm font-normal placeholder:text-placeholder-light dark:placeholder:text-placeholder-dark"
                    placeholder="#맑음 #화창한날씨 #일출"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <button
                    onClick={addTag}
                    className="flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
                  >
                    <span>추가</span>
                  </button>
                </div>
              </label>
              
              {(formData.imageFiles[0] || formData.videoFiles[0]) && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">AI 추천</span>
                      <button
                        type="button"
                        onClick={requestAiTagSuggestion}
                        disabled={loadingAITags}
                        title="AI 태그 다시 추천"
                        aria-label="AI 태그 다시 추천"
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-40 dark:text-primary dark:hover:bg-primary/15"
                      >
                        <span className="material-symbols-outlined text-[22px] leading-none">refresh</span>
                      </button>
                    </div>
                    {loadingAITags && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-primary dark:text-primary">
                        <div className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>분석 중…</span>
                      </div>
                    )}
                    {!loadingAITags && autoTags.length > 0 && (
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        {autoTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addAutoTag(tag)}
                            className="bg-transparent p-0 text-xs font-medium text-primary hover:text-primary-dark hover:underline dark:text-primary dark:hover:text-primary-soft"
                          >
                            {tag}
                            <span className="ml-0.5 text-[10px] text-primary/70 dark:text-primary/80">+</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              
              {formData.tags.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">선택한 태그</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-dark dark:text-primary"
                      >
                        <span className="tracking-tight">{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="px-0.5 text-[11px] font-bold text-primary/60 hover:text-primary-dark dark:text-primary/70 dark:hover:text-primary-soft"
                          aria-label={`${tag} 제거`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="flex flex-col">
                <div className="flex items-center justify-between gap-2 pb-2">
                  <p className="text-base font-medium text-gray-900">이 순간의 이야기</p>
                  <div className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700">
                    {displayDateLine}
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    ref={noteAreaRef}
                    className="form-textarea w-full max-h-[280px] min-h-[76px] resize-none overflow-y-auto rounded-lg border border-subtle-light bg-background-light p-3 text-sm font-normal placeholder:text-placeholder-light focus:border-primary focus:ring-0 dark:border-subtle-dark dark:bg-background-dark dark:placeholder:text-placeholder-dark"
                    placeholder="지금 이곳이 어떤지(분위기, 사람, 날씨 등)를 간단히 적어주세요"
                    rows={2}
                    value={formData.note}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData((prev) => ({ ...prev, note: v }));
                      requestAnimationFrame(() => growNoteArea());
                    }}
                  />
                </div>
              </label>
            </div>

            {/* 업로드 버튼 */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  logger.debug('Upload button clicked');
                  logger.debug('Current state:', {
                    uploading,
                    hasMedia,
                    location: formData.location,
                    noteFilled,
                    canSubmit,
                  });
                  handleSubmit();
                }}
                disabled={!canSubmit}
                className={`flex w-full items-center justify-center rounded-lg h-10 px-3 text-sm font-semibold transition-colors shadow-sm ${
                  !canSubmit
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90 active:scale-[0.99]'
                }`}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    <span>업로드 중...</span>
                  </>
                ) : (
                  <span>여행 기록 업로드</span>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* 하단 네비게이션 바 */}
        <BottomNavigation />

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
              <h3 className="text-lg font-bold text-center mb-4">사진 선택</h3>
              <button
                onClick={() => handlePhotoOptionSelect('camera')}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-subtle-light dark:border-subtle-dark rounded-lg h-14 px-4 text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined">photo_camera</span>
                <span>촬영하기</span>
              </button>
              <button
                onClick={() => handlePhotoOptionSelect('gallery')}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-subtle-light dark:border-subtle-dark rounded-lg h-14 px-4 text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined">photo_library</span>
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
                    <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-5xl">
                      check_circle
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
            </div>
          </div>
        )}

        {showBadgeModal && earnedBadge && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 animate-fade-in">
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
                {getBadgeDisplayName(earnedBadge) || earnedBadge?.name || ''}
              </p>
              
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  earnedBadge.difficulty === '상' || earnedBadge.difficulty === 3 ? 'bg-primary-dark text-white' :
                  earnedBadge.difficulty === '중' || earnedBadge.difficulty === 2 ? 'bg-blue-500 text-white' :
                  'bg-green-500 text-white'
                }`}>
                  난이도:{' '}
                  {typeof earnedBadge.difficulty === 'number'
                    ? ['하', '중', '상'][Math.min(2, Math.max(0, earnedBadge.difficulty - 1))] || earnedBadge.difficulty
                    : earnedBadge.difficulty || '하'}
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










































