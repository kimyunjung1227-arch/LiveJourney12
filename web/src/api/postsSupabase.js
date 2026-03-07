import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

// blob: URL은 새로고침 시 사라지므로 Supabase에는 https URL만 저장
const onlyPersistentUrls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((url) => typeof url === 'string' && url.trim().startsWith('https://'));
};

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

// Supabase posts 테이블에 게시물 저장 (user_id는 로그인 사용자 UUID일 때 저장)
export const createPostSupabase = async (post) => {
  try {
    if (!post) return { success: false, error: 'no_post' };

    const userId = post.userId ?? (post.user && typeof post.user === 'object' ? post.user.id : null);
    const authorName = post.user && typeof post.user === 'object' ? (post.user.username || null) : null;
    const authorAvatar = post.user && typeof post.user === 'object' ? (post.user.profileImage || null) : null;
    const payload = {
      user_id: isValidUuid(userId) ? userId : null,
      author_username: authorName || null,
      author_avatar_url: authorAvatar || null,
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
      comments: Array.isArray(post.comments) ? post.comments : [],
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
        hint: 'Supabase SQL Editor에서 web/supabase-setup.sql 내용 실행하세요.',
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
    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', trimmed)
      .select('id');
    if (error) {
      logger.warn('Supabase deletePost 실패:', error.message, error.code);
      const isRls = error.code === '42501' || (error.message || '').toLowerCase().includes('policy');
      return {
        success: false,
        error: error.message,
        hint: isRls ? 'Supabase에서 admin_users에 본인 user_id 추가 후 posts 삭제 정책 확인' : undefined,
      };
    }
    const deleted = Array.isArray(data) && data.length > 0;
    if (deleted) logger.log('✅ Supabase 게시물 DB 삭제 완료:', trimmed);
    else logger.warn('deletePostSupabase: 삭제된 행 없음 (이미 없거나 RLS 권한 없음)', trimmed);
    return { success: deleted, error: deleted ? null : '삭제된 행 없음' };
  } catch (e) {
    logger.warn('Supabase deletePost 예외:', e?.message);
    return { success: false, error: e?.message };
  }
};

// Supabase 게시물 좋아요 수 갱신 (토글 시 호출)
export const updatePostLikesSupabase = async (postId, delta) => {
  if (!postId || typeof postId !== 'string') return { success: false };
  const trimmed = postId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return { success: false };
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', trimmed)
      .single();
    if (fetchErr || row == null) {
      logger.warn('updatePostLikesSupabase: fetch 실패', fetchErr?.message);
      return { success: false };
    }
    const current = Number(row.likes_count) || 0;
    const newCount = Math.max(0, current + delta);
    const { error: updateErr } = await supabase
      .from('posts')
      .update({ likes_count: newCount })
      .eq('id', trimmed);
    if (updateErr) {
      logger.warn('updatePostLikesSupabase: update 실패', updateErr.message);
      return { success: false };
    }
    return { success: true, likesCount: newCount };
  } catch (e) {
    logger.warn('updatePostLikesSupabase 예외:', e?.message);
    return { success: false };
  }
};

// Supabase에서 단일 게시물 조회 (상세 화면 진입 시 최신 좋아요·미디어 반영용)
const mapRowToPost = (row) => {
  if (!row) return null;
  const uid = row.user_id;
  const userObj =
    uid != null
      ? { id: uid, username: row.author_username || null, profileImage: row.author_avatar_url || null }
      : uid;
  return {
    id: row.id,
    userId: uid,
    user: userObj,
    images: Array.isArray(row.images) ? row.images : (row.images ? [row.images] : []),
    videos: Array.isArray(row.videos) ? row.videos : (row.videos ? [row.videos] : []),
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
    likes: Number(row.likes_count) || 0,
    likeCount: Number(row.likes_count) || 0,
    comments: Array.isArray(row.comments) ? row.comments : [],
    category: row.category || null,
    categoryName: row.category_name || null,
    thumbnail: (Array.isArray(row.images) && row.images[0]) || row.images || null,
    weather: row.weather || null,
  };
};

export const fetchPostByIdSupabase = async (postId) => {
  if (!postId || typeof postId !== 'string') return null;
  const trimmed = postId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return null;
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', trimmed)
      .single();
    if (error || !data) return null;
    return mapRowToPost(data);
  } catch (e) {
    logger.warn('fetchPostByIdSupabase 예외:', e?.message);
    return null;
  }
};

// Supabase 게시물에 댓글 추가 (DB 기준 추적)
export const addCommentToPostSupabase = async (postId, commentPayload) => {
  if (!postId || typeof postId !== 'string' || !commentPayload) return { success: false, comments: [] };
  const trimmed = postId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return { success: false, comments: [] };
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('posts')
      .select('*')
      .eq('id', trimmed)
      .single();
    if (fetchErr || row == null) {
      logger.warn('addCommentToPostSupabase: fetch 실패', fetchErr?.message);
      return { success: false, comments: [] };
    }
    const current = Array.isArray(row.comments) ? row.comments : (row.comments ? [row.comments] : []);
    const next = [...current, { ...commentPayload, createdAt: commentPayload.timestamp || new Date().toISOString() }];
    const { error: updateErr } = await supabase
      .from('posts')
      .update({ comments: next })
      .eq('id', trimmed);
    if (updateErr) {
      logger.warn('addCommentToPostSupabase: update 실패', updateErr.message);
      return { success: false, comments: current };
    }
    return { success: true, comments: next };
  } catch (e) {
    logger.warn('addCommentToPostSupabase 예외:', e?.message);
    return { success: false, comments: [] };
  }
};

// Supabase에서 특정 사용자(user_id)가 올린 게시물만 조회 (프로필 기록용, 로그아웃 후 재로그인해도 유지)
export const fetchPostsByUserIdSupabase = async (userId) => {
  if (!userId || typeof userId !== 'string') return [];
  const trimmed = userId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return [];
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', trimmed)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((row) => {
      const uid = row.user_id;
      const userObj =
        uid != null
          ? { id: uid, username: row.author_username || null, profileImage: row.author_avatar_url || null }
          : uid;
      return {
        id: row.id,
        userId: uid,
        user: userObj,
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
        likes: Number(row.likes_count) || 0,
        likeCount: Number(row.likes_count) || 0,
        comments: Array.isArray(row.comments) ? row.comments : [],
        category: row.category || null,
        categoryName: row.category_name || null,
        thumbnail: (Array.isArray(row.images) && row.images[0]) || null,
      };
    });
  } catch (error) {
    logger.warn('Supabase fetchPostsByUserId 실패:', error?.message);
    return [];
  }
};

/** 뱃지/활동 통계용: Supabase + localStorage 병합된 '내 게시물' (로그아웃 후 재로그인해도 활동 쌓임) */
export const getMergedMyPostsForStats = async (userId) => {
  const fromSupabase = await fetchPostsByUserIdSupabase(userId);
  const local = JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem('uploadedPosts') || '[]' : '[]');
  const localMine = (local || []).filter((p) => (p.userId || p.user?.id) === userId);
  const byId = new Map();
  fromSupabase.forEach((p) => byId.set(p.id, p));
  localMine.forEach((p) => {
    if (!byId.has(p.id)) byId.set(p.id, p);
  });
  return [...byId.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
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

    return data.map((row) => {
      const uid = row.user_id;
      const userObj =
        uid != null
          ? { id: uid, username: row.author_username || null, profileImage: row.author_avatar_url || null }
          : uid;
      return {
      id: row.id,
      userId: uid,
      user: userObj,
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
      likes: Number(row.likes_count) || 0,
      likeCount: Number(row.likes_count) || 0,
      comments: Array.isArray(row.comments) ? row.comments : [],
      category: row.category || null,
      categoryName: row.category_name || null,
      thumbnail: (Array.isArray(row.images) && row.images[0]) || null,
    };
    });
  } catch (error) {
    logger.warn('Supabase fetchPosts 실패 (localStorage fallback 사용):', error);
    return [];
  }
};


