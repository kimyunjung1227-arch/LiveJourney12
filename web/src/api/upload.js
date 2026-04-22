import api from './axios';
import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';
import { getApiBasePath } from '../utils/apiBase';

const API_BASE = getApiBasePath();
const UPLOAD_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

// Supabase Storage 버킷 이름 (콘솔에서 동일한 이름으로 생성 필요)
const SUPABASE_IMAGE_BUCKET = 'post-images';

/**
 * 표시용 이미지/동영상 URL로 변환
 * - 상대 경로(/uploads/...) → 서버 풀 URL
 * - http/https/blob 은 그대로 반환
 * - url 이 객체면 url.url 또는 url.src 등 문자열로 추출 후 변환
 */
// blob: URL은 새로고침 후 사라져 404 발생 → placeholder 반환으로 요청 방지
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNlNWU3ZWIiLz48cGF0aCBkPSJNMjAgMTR2MTJNMTRIMjBoMTIiIHN0cm9rZT0iIzljYTljYSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';

/**
 * DB에 https 전체 URL이 아니라 `uploads/...` · `videos/...` 만 들어 있는 경우 공개 URL로 복원
 */
const resolveSupabaseBucketRelativePath = (trimmed) => {
  if (!trimmed || /^(https?:|\/|data:|blob:)/i.test(trimmed)) return '';
  const pathOnly = trimmed.split(/[?#]/)[0].trim();
  if (!pathOnly || !/^(uploads\/|videos\/)/i.test(pathOnly)) return '';
  try {
    if (supabase) {
      const { data } = supabase.storage.from(SUPABASE_IMAGE_BUCKET).getPublicUrl(pathOnly);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch {
    /* ignore */
  }
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? String(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')
      : '';
  if (!base) return '';
  const enc = pathOnly
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${base}/storage/v1/object/public/${SUPABASE_IMAGE_BUCKET}/${enc}`;
};

/** HTTPS 페이지에서 Supabase 스토리지 http 링크가 막히는 경우 방지 */
const upgradeSupabaseHttpToHttps = (url) => {
  if (!url || !url.startsWith('http://')) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('.supabase.co')) {
      u.protocol = 'https:';
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
};

const IMAGE_FILE_EXT = /\.(jpe?g|png|webp|avif|bmp)(\?|#|$)/i;

/** 카드·피드 등에서 불필요하게 큰 원본 대신 적당한 폭만 요청 */
function supabaseFeedMaxWidthPx() {
  if (typeof window === 'undefined') return 960;
  const cssW = window.innerWidth || 1024;
  const dpr = typeof window.devicePixelRatio === 'number' ? Math.min(2, window.devicePixelRatio) : 1;
  if (cssW >= 1440) return Math.min(1400, Math.round(cssW * dpr * 0.5));
  if (cssW >= 1024) return Math.min(1200, Math.round(cssW * dpr * 0.6));
  if (cssW >= 600) return Math.min(960, Math.round(cssW * dpr * 0.85));
  return Math.min(840, Math.round(cssW * dpr));
}

/** 베스트 컷 풀폭 히어로 등 — DPR 반영해 변환 시 더 높은 폭·품질 */
function supabaseHeroMaxWidthPx() {
  if (typeof window === 'undefined') return 1680;
  const cssW = window.innerWidth || 1024;
  const dpr = typeof window.devicePixelRatio === 'number' ? Math.min(2.5, window.devicePixelRatio) : 1;
  return Math.min(2048, Math.round(cssW * dpr));
}

/**
 * Supabase Storage 공개 이미지 → Image Transformation(render) URL (용량·디코딩 시간 단축)
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 * 기본 OFF(무료 플랜 호환). Pro 등에서 켤 때: VITE_SUPABASE_IMAGE_TRANSFORM=true
 */
/**
 * @param {{ hero?: boolean, maxWidth?: number, quality?: number }} [opts]
 * - hero: 베스트 컷 등 대형 표시용(더 넓은 width·높은 quality)
 */
function applySupabaseImageResize(absoluteUrl, opts) {
  if (!absoluteUrl || absoluteUrl.startsWith('data:')) return absoluteUrl;
  if (typeof import.meta === 'undefined' || String(import.meta.env?.VITE_SUPABASE_IMAGE_TRANSFORM || '').trim() !== 'true') {
    return absoluteUrl;
  }
  const pathNoQuery = absoluteUrl.split('?')[0].split('#')[0];
  if (/\.gif(\?|#|$)/i.test(pathNoQuery)) return absoluteUrl;
  if (!IMAGE_FILE_EXT.test(pathNoQuery)) return absoluteUrl;
  if (absoluteUrl.includes('/storage/v1/render/image/public/')) return absoluteUrl;
  try {
    const u = new URL(absoluteUrl);
    if (!u.hostname.endsWith('.supabase.co')) return absoluteUrl;
    const marker = '/storage/v1/object/public/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return absoluteUrl;
    const rest = u.pathname.slice(idx + marker.length);
    if (!rest) return absoluteUrl;
    const out = new URL(`/storage/v1/render/image/public/${rest}`, u.origin);
    u.searchParams.forEach((v, k) => {
      out.searchParams.set(k, v);
    });
    const widthPx =
      typeof opts?.maxWidth === 'number' && opts.maxWidth > 0
        ? opts.maxWidth
        : opts?.hero
          ? supabaseHeroMaxWidthPx()
          : supabaseFeedMaxWidthPx();
    const quality =
      typeof opts?.quality === 'number' && opts.quality > 0 && opts.quality <= 100
        ? opts.quality
        : opts?.hero
          ? 90
          : 80;
    out.searchParams.set('width', String(widthPx));
    out.searchParams.set('quality', String(quality));
    return out.toString();
  } catch {
    return absoluteUrl;
  }
}

/** @param {{ hero?: boolean, maxWidth?: number, quality?: number }} [opts] */
export const getDisplayImageUrl = (url, opts) => {
  if (url == null) return PLACEHOLDER_IMAGE;
  let raw = typeof url === 'string' ? url : (url.url || url.src || url.href || '');
  if (!raw || typeof raw !== 'string') return PLACEHOLDER_IMAGE;
  const trimmed = raw.trim();
  if (!trimmed) return PLACEHOLDER_IMAGE;

  // 일부 레거시 데이터: 문자열로 JSON({ url })이 저장된 케이스 복원
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const extracted = typeof parsed === 'string' ? parsed : (parsed?.url || parsed?.src || parsed?.href || '');
      if (typeof extracted === 'string' && extracted.trim()) {
        raw = extracted;
      }
    } catch {
      /* ignore */
    }
  }

  const reTrimmed = String(raw || '').trim();
  if (!reTrimmed) return PLACEHOLDER_IMAGE;
  // blob: URL은 새로고침 후 사라질 수 있지만, 업로드 직후 "동영상/이미지 즉시 표시"에는 필요하다.
  // 기본은 placeholder로 안전하게 막되, 호출부에서 opts.allowBlob=true면 그대로 허용한다.
  if (reTrimmed.startsWith('blob:')) return opts?.allowBlob ? reTrimmed : PLACEHOLDER_IMAGE;

  let resolved;
  const fromBucket = resolveSupabaseBucketRelativePath(reTrimmed);
  if (fromBucket) {
    resolved = upgradeSupabaseHttpToHttps(fromBucket);
  } else if (reTrimmed.startsWith('http://') || reTrimmed.startsWith('https://')) {
    resolved = upgradeSupabaseHttpToHttps(reTrimmed);
  } else if (reTrimmed.startsWith('/')) {
    resolved = `${UPLOAD_ORIGIN}${reTrimmed}`;
  } else {
    resolved = reTrimmed;
  }

  return applySupabaseImageResize(resolved, opts) || PLACEHOLDER_IMAGE;
};

// 이미지를 Base64로 변환
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

/**
 * 디코드 후 재인코딩하여 EXIF/GPS 등 파일 내 메타데이터 제거 (업로드 직전에 사용)
 */
const stripImageMetadata = async (file) => {
  if (!file || !file.type?.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    if (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    let mimeType = 'image/jpeg';
    let quality = 0.92;
    if (file.type === 'image/png') {
      mimeType = 'image/png';
      quality = undefined;
    } else if (file.type === 'image/webp') {
      mimeType = 'image/webp';
    }

    let outBlob;
    let outMime = mimeType;
    let ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';

    try {
      outBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          mimeType,
          quality
        );
      });
    } catch {
      outMime = 'image/jpeg';
      ext = 'jpg';
      outBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob jpeg failed'))),
          'image/jpeg',
          0.92
        );
      });
    }

    return new File([outBlob], `${baseName}.${ext}`, {
      type: outMime,
      lastModified: Date.now(),
    });
  } catch (e) {
    logger.warn('이미지 메타데이터 제거 실패, 원본 업로드:', e?.message || e);
    return file;
  }
};

// Supabase Storage 에 이미지 업로드 후 public URL 반환 (실패 시 1회 재시도)
const uploadImageToSupabase = async (file, retry = false) => {
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const ext = file.name?.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase
      .storage
      .from(SUPABASE_IMAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase
      .storage
      .from(SUPABASE_IMAGE_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      throw new Error('Failed to get public URL from Supabase');
    }

    logger.log('✅ Supabase Storage 이미지 업로드 성공:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      isTemporary: false,
      storage: 'supabase',
    };
  } catch (error) {
    if (!retry) {
      logger.warn('Supabase Storage 1차 실패, 재시도...', error?.message);
      await new Promise((r) => setTimeout(r, 500));
      return uploadImageToSupabase(file, true);
    }
    logger.warn('Supabase Storage 이미지 업로드 실패 (백엔드/Blob fallback):', error?.message);
    return { success: false, error };
  }
};

// 단일 이미지 업로드
export const uploadImage = async (file) => {
  let safeFile = file;
  try {
    safeFile = await stripImageMetadata(file);
    // 1순위: Supabase Storage 업로드 시도
    const supabaseResult = await uploadImageToSupabase(safeFile);
    if (supabaseResult.success && supabaseResult.url) {
      return supabaseResult;
    }

    // 2순위: 기존 백엔드 REST API 시도
    const formData = new FormData();
    formData.append('image', safeFile);

    const response = await api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    // Supabase / 백엔드 모두 실패 시 마지막 fallback: Blob URL
    logger.log('⚠️ 이미지 업로드 실패 - Blob URL fallback 사용');
    logger.warn('💡 이미지가 서버(Supabase/백엔드)에 업로드되지 않았습니다. 네트워크 또는 설정을 확인해주세요.');

    const blobUrl = URL.createObjectURL(safeFile);

    return {
      success: true,
      url: blobUrl,
      isTemporary: true,
      analysis: {
        category: 'general',
        categoryName: '일반',
        labels: []
      }
    };
  }
};

// 다중 이미지 업로드
export const uploadImages = async (files) => {
  try {
    const safeFiles = await Promise.all(files.map((f) => stripImageMetadata(f)));
    const formData = new FormData();
    safeFiles.forEach(file => {
      formData.append('images', file);
    });

    const response = await api.post('/upload/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    logger.error('이미지 업로드 실패:', error);
    throw error;
  }
};

// 프로필 이미지 업로드
export const uploadProfileImage = async (file) => {
  try {
    const safeFile = await stripImageMetadata(file);
    const formData = new FormData();
    formData.append('profile', safeFile);

    const response = await api.post('/upload/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('프로필 이미지 업로드 실패:', error);
    throw error;
  }
};

// Supabase Storage에 동영상 업로드 (post-images 버킷 또는 동일 정책 사용)
const uploadVideoToSupabase = async (file) => {
  try {
    if (!supabase) throw new Error('Supabase not initialized');
    const ext = file.name?.split('.').pop() || 'mp4';
    const fileName = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_IMAGE_BUCKET)
      .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'video/mp4' });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(SUPABASE_IMAGE_BUCKET).getPublicUrl(fileName);
    if (data?.publicUrl) {
      logger.log('✅ Supabase 동영상 업로드 성공:', data.publicUrl);
      return { success: true, url: data.publicUrl, isTemporary: false };
    }
    throw new Error('No public URL');
  } catch (e) {
    logger.warn('Supabase 동영상 업로드 실패:', e);
    return { success: false };
  }
};

// 단일 동영상 업로드 (Supabase 우선, 백엔드 없으면 Blob URL)
export const uploadVideo = async (file) => {
  const supabaseResult = await uploadVideoToSupabase(file);
  if (supabaseResult.success && supabaseResult.url) {
    return supabaseResult;
  }
  try {
    const formData = new FormData();
    formData.append('video', file);
    const response = await api.post('/upload/video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const data = response.data;
    return { success: true, url: data.url || data.videoUrl, ...data };
  } catch (error) {
    // ⚠️ 동영상은 blob: fallback을 "성공"으로 취급하면 DB에 영구 URL이 저장되지 않아
    // 업로드 후 피드/상세에서 동영상이 사라진 것처럼 보입니다(onlyPersistentUrls 필터).
    // 따라서 최종 저장이 불가능한 경우는 실패로 반환해 화면에서 재시도/에러 처리를 하게 합니다.
    logger.warn('동영상 업로드 실패: Supabase/백엔드 모두 실패', error?.message || error);
    return { success: false, error };
  }
};















