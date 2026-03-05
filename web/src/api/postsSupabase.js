import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

// Supabase posts 테이블에 게시물 저장 (user_id는 public.users 연동 전까지 null로 저장해 FK 오류 방지)
export const createPostSupabase = async (post) => {
  try {
    if (!post) return { success: false, error: 'no_post' };

    // public.users에 로그인 사용자가 없으면 FK(23503) 발생 → 업로드 실패 방지를 위해 user_id는 null로 저장
    const payload = {
      user_id: null,
      content: post.note || post.content || '',
      images: Array.isArray(post.images) ? post.images : [],
      videos: Array.isArray(post.videos) ? post.videos : [],
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
    logger.error('Supabase createPost 실패:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      success: false,
      error: error.message || error.code || 'unknown_error',
    };
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


