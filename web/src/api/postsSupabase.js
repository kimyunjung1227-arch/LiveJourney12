import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

// blob: URL은 새로고침 시 사라지므로 Supabase에는 https URL만 저장
const onlyPersistentUrls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((url) => typeof url === 'string' && url.trim().startsWith('https://'));
};

// Supabase posts 테이블에 게시물 저장 (user_id는 public.users 연동 전까지 null로 저장해 FK 오류 방지)
export const createPostSupabase = async (post) => {
  try {
    if (!post) return { success: false, error: 'no_post' };

    const payload = {
      user_id: null,
      content: post.note || post.content || '',
      images: onlyPersistentUrls(post.images),
      videos: onlyPersistentUrls(post.videos),
      location: post.location || null,
      detailed_location: post.detailedLocation || null,
      place_name: post.placeName || null,
      region: post.region || null,
      tags: Array.isArray(post.tags)
        ? post.tags.map((t) => (typeof t === 'string' ? t.replace(/^#+/, '') : String(t || '')))
        : [],
      category: post.category || null,
      category_name: post.categoryName || null,
      likes_count: post.likes || 0,
      captured_at: post.photoDate ? new Date(post.photoDate) : null,
      created_at: post.createdAt ? new Date(post.createdAt) : new Date(),
    };

    let { data, error } = await supabase
      .from('posts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return { success: true, post: data };
  } catch (error) {
    const code = error?.code;
    const msg = (error?.message || '').toLowerCase();
    logger.error('Supabase createPost 실패:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      status: error?.status ?? error?.statusCode,
    });

    // 23502: user_id NOT NULL 제약
    if (code === '23502' && (error?.message || '').includes('user_id')) {
      return {
        success: false,
        error: 'user_id_not_null',
        code,
        hint: 'Supabase SQL Editor에서 실행: ALTER TABLE posts ALTER COLUMN user_id DROP NOT NULL;',
      };
    }

    // 403 / 42501 또는 메시지에 RLS 언급: 정책으로 차단
    const status = error?.status ?? error?.statusCode;
    const isRls = code === '42501' || status === 403 || msg.includes('row-level security') || msg.includes('violates');
    if (isRls) {
      return {
        success: false,
        error: 'rls_forbidden',
        code: code || 403,
        hint: 'Supabase SQL Editor에서 web/supabase-posts-한번에-수정.sql 내용 실행하세요.',
      };
    }

    return {
      success: false,
      error: error?.message || error?.code || 'unknown_error',
      code: error?.code,
    };
  }
};

// Supabase posts 테이블에서 게시물 삭제 (프로필에서 사진 삭제 시 호출)
export const deletePostSupabase = async (postId) => {
  if (!postId || typeof postId !== 'string') return { success: false, error: 'no_post_id' };
  const trimmed = postId.trim();
  // Supabase UUID 형식일 때만 삭제 시도 (backend-123 같은 클라이언트 id는 무시)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) {
    logger.debug('deletePostSupabase: UUID 아님, Supabase 삭제 스킵', trimmed);
    return { success: true };
  }
  try {
    const { error } = await supabase.from('posts').delete().eq('id', trimmed);
    if (error) {
      logger.warn('Supabase deletePost 실패:', error.message);
      return { success: false, error: error.message };
    }
    logger.log('✅ Supabase 게시물 삭제 완료:', trimmed);
    return { success: true };
  } catch (e) {
    logger.warn('Supabase deletePost 예외:', e?.message);
    return { success: false, error: e?.message };
  }
};

// Supabase에서 게시물 목록 읽기
export const fetchPostsSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      user: row.user_id,
      images: Array.isArray(row.images) ? row.images : [],
      videos: Array.isArray(row.videos) ? row.videos : [],
      location: row.location || '',
      detailedLocation: row.detailed_location || '',
      placeName: row.place_name || '',
      region: row.region || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
      note: row.content || '',
      content: row.content || '',
      timestamp: row.created_at ? new Date(row.created_at).getTime() : null,
      createdAt: row.created_at || null,
      photoDate: row.captured_at || row.created_at || null,
      likes: row.likes_count || 0,
      category: row.category || null,
      categoryName: row.category_name || null,
      thumbnail: (Array.isArray(row.images) && row.images[0]) || null,
    }));
  } catch (error) {
    logger.warn('Supabase fetchPosts 실패 (localStorage fallback 사용):', error);
    return [];
  }
};


