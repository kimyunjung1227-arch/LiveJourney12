/**
 * AI 기반 해시태그 생성
 * 1순위: Supabase Edge Function (API 키는 Supabase Secrets에 설정)
 * 2순위: 기존 백엔드 /upload/analyze-tags
 * 실패 시: null 반환 → 로컬 이미지/위치 기반 태그로 폴백
 *
 * ⚠️ Edge Function 502 방지: 400KB 초과 또는 긴 변 1024 초과 시 리사이즈 (최대 1024px, JPEG ~0.65, 목표 ~450KB)
 */
import api from './axios';
import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';

/** 502 방지: 해상도·용량을 보수적으로 (768px, 300KB 이하 권장) */
const MAX_WIDTH_AI = 768;
const JPEG_QUALITY = 0.6;
/** 이 크기 초과 시 무조건 리사이즈 */
const MAX_SIZE_BEFORE_RESIZE = 250 * 1024;
/** 리사이즈 후 목표 최대 크기 (초과 시 품질 추가 하락) */
const TARGET_MAX_BYTES = 300 * 1024;

/** 이미지를 AI 분석용으로 리사이즈·압축 (Edge Function 502 방지, 항상 안전한 크기로 전송) */
const resizeImageForAI = (file) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const shouldResizeBySize = file.size > MAX_SIZE_BEFORE_RESIZE;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const needsScale = width > MAX_WIDTH_AI || height > MAX_WIDTH_AI;
        const shouldResize = shouldResizeBySize || needsScale;
        if (!shouldResize) {
          resolve(file);
          return;
        }
        if (needsScale || shouldResizeBySize) {
          const maxSide = Math.max(width, height);
          if (maxSide > MAX_WIDTH_AI) {
            const scale = MAX_WIDTH_AI / maxSide;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
        }

        const doResize = (image, w, h, quality = JPEG_QUALITY) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(image, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const resized = new File([blob], file.name, { type: 'image/jpeg' });
              if (resized.size > TARGET_MAX_BYTES && quality > 0.35) {
                doResize(image, w, h, quality - 0.08);
                return;
              }
              logger.log('📐 AI용 이미지 리사이즈:', `${(file.size / 1024).toFixed(0)}KB → ${(resized.size / 1024).toFixed(0)}KB`);
              resolve(resized);
            },
            'image/jpeg',
            quality
          );
        };
        doResize(img, width, height);
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result ?? '';
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result || '';
      const base64 = typeof dataUrl === 'string' && dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Supabase Edge Function으로 AI 태그 생성 (OpenAI API 키는 Supabase Secrets에만 둠)
 */
const generateAITagsViaSupabase = async (imageFile, location = '', exifData = null) => {
  if (!supabase) return null;
  try {
    const resized = await resizeImageForAI(imageFile);
    const imageBase64 = await fileToBase64(resized);
    const base64Str = typeof imageBase64 === 'string' ? imageBase64.replace(/\s/g, '') : '';
    if (!base64Str || base64Str.length < 100) {
      logger.warn('AI 태그: 리사이즈 후 base64 유효하지 않음');
      return null;
    }
    const mimeType = (resized.type || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
    const locationStr = typeof location === 'string' ? location : (location && location.name) ? String(location.name) : '';
    const body = {
      imageBase64: base64Str,
      mimeType,
      location: locationStr,
      exifData: exifData && typeof exifData === 'object' ? exifData : undefined,
    };
    const { data, error } = await supabase.functions.invoke('analyze-tags', {
      body,
    });
    if (error) {
      logger.warn('Supabase AI 태그 Edge Function 오류:', error.message);
      return null;
    }
    if (data && !data.success && data.detail) {
      logger.warn('AI 태그 서버 응답:', data.message || 'error', data.detail?.slice?.(0, 200));
    }
    if (data && (data.success || data.category)) {
      const hasTags = Array.isArray(data.tags) && data.tags.length > 0;
      logger.log('✅ Supabase AI 응답:', hasTags ? `${data.tags.length}개 태그` : '태그 없음', data.category ? `카테고리 ${data.category}` : '');
      return {
        success: !!data.success,
        tags: Array.isArray(data.tags) ? data.tags : [],
        caption: data.caption || null,
        method: data.method || 'supabase-edge-gemini',
        category: data.category || null,
        categoryName: data.categoryName || null,
        categoryIcon: data.categoryIcon || null,
      };
    }
    return null;
  } catch (e) {
    logger.warn('Supabase AI 태그 호출 예외:', e?.message);
    return null;
  }
};

/**
 * 기존 백엔드 API 호출 (로컬 개발 시에만, 배포 환경에서는 호출 안 함 → CORS/ERR_CONNECTION_REFUSED 방지)
 */
const generateAITagsViaBackend = async (imageFile, location = '', exifData = null) => {
  const isLocal = typeof window !== 'undefined' && (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1');
  if (!isLocal) return null;
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('location', location);
  if (exifData) formData.append('exifData', JSON.stringify(exifData));
  const response = await api.post('/upload/analyze-tags', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  if (response.data?.success && response.data?.tags?.length > 0) {
    return {
      success: true,
      tags: response.data.tags,
      caption: response.data.caption || null,
      method: response.data.method || 'multimodal-ai',
    };
  }
  return null;
};

/**
 * 이미지 파일 → AI 태그 생성 (Supabase Edge Function 우선, 실패 시 백엔드 → null이면 로컬 분석)
 */
export const generateAITags = async (imageFile, location = '', exifData = null) => {
  try {
    logger.log('📤 AI 태그 생성 시도 (Supabase Edge Function 우선)');
    logger.log('  이미지:', imageFile?.name, imageFile?.size, 'bytes');
    logger.log('  위치:', location);

    const supabaseResult = await generateAITagsViaSupabase(imageFile, location, exifData);
    if (supabaseResult) return supabaseResult;

    try {
      const backendResult = await generateAITagsViaBackend(imageFile, location, exifData);
      if (backendResult) return backendResult;
    } catch (_) {
      logger.warn('⚠️ AI 태그 API 사용 불가(백엔드 미연결) → 로컬 태그 사용');
    }

    return null;
  } catch (error) {
    const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
    if (isNetworkError) {
      logger.warn('⚠️ AI 태그 API 사용 불가 → 로컬 태그 사용');
    } else {
      logger.warn('❌ AI 태그 생성 실패:', error?.message);
    }
    return null;
  }
};
