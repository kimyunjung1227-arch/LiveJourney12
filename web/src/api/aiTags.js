/**
 * AI 기반 해시태그 생성
 * 1순위: Supabase Edge Function (OpenAI Vision, API 키는 Supabase Secrets에 설정)
 * 2순위: 기존 백엔드 /upload/analyze-tags
 * 실패 시: null 반환 → 로컬 이미지/위치 기반 태그로 폴백
 */
import api from './axios';
import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';

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
    const imageBase64 = await fileToBase64(imageFile);
    const mimeType = imageFile.type || 'image/jpeg';
    const { data, error } = await supabase.functions.invoke('analyze-tags', {
      body: { imageBase64, mimeType, location, exifData: exifData || undefined },
    });
    if (error) {
      logger.warn('Supabase AI 태그 Edge Function 오류:', error.message);
      return null;
    }
    if (data && data.success && Array.isArray(data.tags) && data.tags.length > 0) {
      logger.log('✅ Supabase AI 태그 생성 성공:', data.tags?.length, '개');
      return {
        success: true,
        tags: data.tags,
        caption: data.caption || null,
        method: data.method || 'supabase-edge-gemini',
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
