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

/** 502 방지: 해상도·용량을 더 보수적으로 (기본 640px, 220KB 이하 권장) */
const MAX_WIDTH_AI = 640;
const JPEG_QUALITY = 0.58;
/** 이 크기 초과 시 무조건 리사이즈 */
const MAX_SIZE_BEFORE_RESIZE = 250 * 1024;
/** 리사이즈 후 목표 최대 크기 (초과 시 품질 추가 하락) */
const TARGET_MAX_BYTES = 220 * 1024;
/** 이 크기를 넘으면 Edge Function 호출 자체를 생략 (gateway 502 예방) */
const MAX_BYTES_FOR_EDGE_CALL = 240 * 1024;

const EDGE_FN_NAME = 'analyze-tags';
const EDGE_FN_COOLDOWN_KEY = 'aiTags_edgeCooldownUntil';
const EDGE_FN_COOLDOWN_MS = 10 * 60 * 1000; // 10분

/** 이미지를 AI 분석용으로 리사이즈·압축 (Edge Function 502 방지, 최대한 호출 가능 크기로 맞춤) */
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

        const doResize = (image, w, h, quality = JPEG_QUALITY, depth = 0) => {
          // 과도한 재귀 방지
          if (depth > 10) {
            resolve(file);
            return;
          }
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
              // 1) 목표치보다 크면 품질을 더 낮춰 재시도
              if (resized.size > TARGET_MAX_BYTES && quality > 0.28) {
                doResize(image, w, h, Math.max(0.26, quality - 0.08), depth + 1);
                return;
              }
              // 2) Edge 호출 상한(240KB)도 넘으면 해상도를 더 줄여 재시도 (대부분 여기서 해결)
              if (resized.size > MAX_BYTES_FOR_EDGE_CALL && Math.max(w, h) > 360) {
                const scale = 0.86;
                doResize(image, Math.round(w * scale), Math.round(h * scale), Math.min(quality, 0.5), depth + 1);
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

const nowMs = () => Date.now();

const getEdgeCooldownUntil = () => {
  try {
    const raw = localStorage.getItem(EDGE_FN_COOLDOWN_KEY);
    const until = raw ? Number(raw) : 0;
    return Number.isFinite(until) ? until : 0;
  } catch {
    return 0;
  }
};

const setEdgeCooldown = () => {
  try {
    localStorage.setItem(EDGE_FN_COOLDOWN_KEY, String(nowMs() + EDGE_FN_COOLDOWN_MS));
  } catch {
    // ignore storage failures
  }
};

const clearEdgeCooldown = () => {
  try {
    localStorage.removeItem(EDGE_FN_COOLDOWN_KEY);
  } catch {
    // ignore storage failures
  }
};

/**
 * Supabase Edge Function으로 AI 태그 생성 (OpenAI API 키는 Supabase Secrets에만 둠)
 */
const generateAITagsViaSupabase = async (imageFile, location = '', exifData = null) => {
  if (!supabase) return null;
  try {
    const cooldownUntil = getEdgeCooldownUntil();
    if (cooldownUntil > nowMs()) {
      const leftSec = Math.max(1, Math.ceil((cooldownUntil - nowMs()) / 1000));
      logger.warn(`Supabase AI 호출 일시 중지 중 (${leftSec}초 후 재시도)`);
      return null;
    }

    const resized = await resizeImageForAI(imageFile);
    if (!resized || resized.size > MAX_BYTES_FOR_EDGE_CALL) {
      logger.warn('AI 태그: 이미지가 커서 Edge 호출 생략, 로컬 분석으로 폴백');
      return null;
    }
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
    const { data, error } = await supabase.functions.invoke(EDGE_FN_NAME, {
      body,
    });
    if (error) {
      const status = error?.context?.status;
      if (status === 502 || /502|Bad Gateway/i.test(error.message || '')) {
        setEdgeCooldown();
      }
      logger.warn('Supabase AI 태그 Edge Function 오류:', error.message);
      return null;
    }
    clearEdgeCooldown();
    if (data && !data.success && data.detail) {
      logger.warn('AI 태그 서버 응답:', data.message || 'error', data.detail?.slice?.(0, 200));
    }
    if (data && (data.success || data.category || (Array.isArray(data.categories) && data.categories.length))) {
      const hasTags = Array.isArray(data.tags) && data.tags.length > 0;
      logger.log('✅ Supabase AI 응답:', hasTags ? `${data.tags.length}개 태그` : '태그 없음', data.category ? `카테고리 ${data.category}` : '');
      return {
        success: !!data.success,
        tags: Array.isArray(data.tags) ? data.tags : [],
        caption: data.caption || null,
        method: data.method || 'supabase-edge-gemini',
        categories: Array.isArray(data.categories) ? data.categories : [],
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
  const d = response.data;
  const hasTags = Array.isArray(d?.tags) && d.tags.length > 0;
  const hasCategory = !!(d?.category || d?.categoryName || (Array.isArray(d?.categories) && d.categories.length));
  if (d?.success && (hasTags || hasCategory)) {
    return {
      success: true,
      tags: Array.isArray(d?.tags) ? d.tags : [],
      caption: d.caption || null,
      method: d.method || 'multimodal-ai',
      categories: Array.isArray(d?.categories) ? d.categories : [],
      category: d.category || null,
      categoryName: d.categoryName || null,
      categoryIcon: d.categoryIcon || null,
    };
  }
  return null;
};

/**
 * 이미지 파일 → AI 태그 생성 (Supabase Edge Function 우선, 실패 시 로컬 백엔드, null이면 로컬 휴리스틱)
 */
export const generateAITags = async (imageFile, location = '', exifData = null) => {
  try {
    const supa = await generateAITagsViaSupabase(imageFile, location, exifData);
    const supaOk =
      supa &&
      (supa.success ||
        (Array.isArray(supa.tags) && supa.tags.length > 0) ||
        supa.category ||
        supa.categoryName ||
        (Array.isArray(supa.categories) && supa.categories.length > 0));
    if (supaOk) {
      logger.log('🤖 Supabase AI 태그/카테고리 응답 사용');
      return { ...supa, success: supa.success !== false };
    }
  } catch (e) {
    logger.warn('Supabase AI 태그 호출 실패:', e?.message);
  }
  try {
    const backend = await generateAITagsViaBackend(imageFile, location, exifData);
    if (backend) {
      logger.log('🤖 로컬 백엔드 AI 태그 응답 사용');
      return backend;
    }
  } catch (e) {
    logger.warn('백엔드 AI 태그 호출 실패:', e?.message);
  }
  logger.log('🤖 원격 AI 없음 → aiImageAnalyzer 로컬 분석으로 폴백');
  return null;
};
