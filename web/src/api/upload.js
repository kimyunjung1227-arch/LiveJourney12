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

export const getDisplayImageUrl = (url) => {
  if (url == null) return '';
  const raw = typeof url === 'string' ? url : (url.url || url.src || url.href || '');
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:')) return PLACEHOLDER_IMAGE;

  const fromBucket = resolveSupabaseBucketRelativePath(trimmed);
  if (fromBucket) return upgradeSupabaseHttpToHttps(fromBucket);

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return upgradeSupabaseHttpToHttps(trimmed);
  }
  if (trimmed.startsWith('/')) return `${UPLOAD_ORIGIN}${trimmed}`;
  return trimmed;
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
    logger.warn('동영상 백엔드 없음 - Blob URL 사용');
    const blobUrl = URL.createObjectURL(file);
    return { success: true, url: blobUrl, isTemporary: true };
  }
};















