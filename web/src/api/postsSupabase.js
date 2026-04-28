import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { fetchCommentsForPostSupabase } from './socialSupabase';

// blob: URL은 새로고침 시 사라지므로 Supabase에는 영구 URL만 저장
const onlyPersistentUrls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((url) => typeof url === 'string' && url.trim())
    .map((url) => {
      const t = url.trim();
      if (t.startsWith('http://') && /\.supabase\.co/i.test(t)) {
        return t.replace(/^http:/i, 'https:');
      }
      return t;
    })
    .filter((url) => url.startsWith('https://'));
};

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

const POST_IMAGES_BUCKET = 'post-images';

const extractStorageObjectPath = (urlOrPath) => {
  if (!urlOrPath) return null;
  const s = String(urlOrPath).trim();
  if (!s) return null;

  // already a relative storage path used by our uploader
  if (s.startsWith('uploads/') || s.startsWith('videos/')) return s;

  // Supabase public URL patterns:
  // - .../storage/v1/object/public/<bucket>/<path>
  // - .../storage/v1/object/sign/<bucket>/<path>?token=...
  const markerPublic = `/storage/v1/object/public/${POST_IMAGES_BUCKET}/`;
  const markerSign = `/storage/v1/object/sign/${POST_IMAGES_BUCKET}/`;
  const iPublic = s.indexOf(markerPublic);
  if (iPublic >= 0) return s.slice(iPublic + markerPublic.length).split('?')[0] || null;
  const iSign = s.indexOf(markerSign);
  if (iSign >= 0) return s.slice(iSign + markerSign.length).split('?')[0] || null;

  return null;
};

const collectStoragePathsFromPost = (postRow) => {
  const urls = [
    ...(Array.isArray(postRow?.images) ? postRow.images : []),
    ...(Array.isArray(postRow?.videos) ? postRow.videos : []),
  ];
  const paths = urls
    .map(extractStorageObjectPath)
    .filter(Boolean);
  return Array.from(new Set(paths));
};

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
      // 업로드 시점 날씨(고정) — jsonb 컬럼 가정
      weather: post.weatherSnapshot || post.weather || null,
      tags: Array.isArray(post.tags)
        ? post.tags.map((t) => (typeof t === 'string' ? t.replace(/^#+/, '') : String(t || '')))
        : [],
      category: post.category || null,
      category_name: post.categoryName || null,
      likes_count: post.likes || 0,
      comments: Array.isArray(post.comments) ? post.comments : [],
      captured_at: post.photoDate ? new Date(post.photoDate) : null,
      created_at: post.createdAt ? new Date(post.createdAt) : new Date(),
      is_in_app_camera: post.isInAppCamera === true,
      exif_data: (() => {
        const base = post.exifData && typeof post.exifData === 'object' ? { ...post.exifData } : {};
        const lat = Number(post?.coordinates?.lat);
        const lng = Number(post?.coordinates?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          base.map_pin = { lat, lng };
        }
        return Object.keys(base).length ? base : null;
      })(),
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

// Supabase 게시물 수정 (작성자만 수정 가능하도록 호출 전에 권한 검사, 사진·내용 포함)
export const updatePostSupabase = async (postId, updates) => {
  if (!postId || typeof postId !== 'string' || !updates || typeof updates !== 'object') return { success: false };
  const trimmed = postId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return { success: false };
  try {
    const payload = {};
    if (updates.content !== undefined) payload.content = updates.content;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.detailed_location !== undefined) payload.detailed_location = updates.detailed_location;
    if (updates.place_name !== undefined) payload.place_name = updates.place_name;
    if (updates.region !== undefined) payload.region = updates.region;
    // 업로드 시점 날씨(고정) 갱신 허용
    if (updates.weather !== undefined) payload.weather = updates.weather;
    if (Array.isArray(updates.tags)) payload.tags = updates.tags.map((t) => (typeof t === 'string' ? t.replace(/^#+/, '') : String(t || '')));
    if (Array.isArray(updates.images)) payload.images = onlyPersistentUrls(updates.images);
    if (Array.isArray(updates.videos)) payload.videos = onlyPersistentUrls(updates.videos);
    if (Object.keys(payload).length === 0) return { success: true };
    const { data, error } = await supabase.from('posts').update(payload).eq('id', trimmed).select('*').single();
    if (error) throw error;
    return { success: true, post: data };
  } catch (e) {
    logger.warn('updatePostSupabase 예외:', e?.message);
    return { success: false };
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
    // 1) 먼저 게시물에서 미디어 URL을 가져와 Storage 경로로 변환
    let storagePaths = [];
    try {
      const { data: row, error: fetchErr } = await supabase
        .from('posts')
        .select('images,videos')
        .eq('id', trimmed)
        .single();
      if (!fetchErr && row) {
        storagePaths = collectStoragePathsFromPost(row);
      }
    } catch (_) {}

    // 2) Storage 객체 삭제(베스트 에포트)
    // - 정책이 없거나(403) 이미 삭제된 경우는 게시물 삭제를 막지 않음
    if (storagePaths.length > 0) {
      const { error: storageErr } = await supabase
        .storage
        .from(POST_IMAGES_BUCKET)
        .remove(storagePaths);
      if (storageErr) {
        logger.warn('Supabase Storage 미디어 삭제 실패(무시하고 계속):', storageErr.message || storageErr);
      } else {
        logger.log('✅ Supabase Storage 미디어 삭제 완료:', { count: storagePaths.length });
      }
    }

    // 3) DB 행 삭제
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

/**
 * 주어진 post IDs 중 현재 사용자가 좋아요한 것들의 Set 반환.
 * - 로그인 안 했거나 유효 UUID가 아니면 빈 Set.
 * - 서버가 단일 진실: post_likes 테이블을 그대로 조회.
 */
export const fetchLikedPostIdsSupabase = async (postIds, userId) => {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return new Set();
  const ids = Array.from(
    new Set((Array.isArray(postIds) ? postIds : []).map((x) => String(x || '').trim()).filter(isValidUuid))
  );
  if (ids.length === 0) return new Set();
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', uid)
      .in('post_id', ids);
    if (error || !Array.isArray(data)) return new Set();
    return new Set(data.map((r) => String(r.post_id)));
  } catch (e) {
    logger.warn('fetchLikedPostIdsSupabase:', e?.message);
    return new Set();
  }
};

/** Supabase `posts` 행 → 앱 공통 post 객체 */
export const mapSupabasePostRowToPost = (row, opts = {}) => {
  if (!row) return null;
  const uid = row.user_id;
  const userObj =
    uid != null
      ? { id: uid, username: row.author_username || null, profileImage: row.author_avatar_url || null }
      : uid;
  const likesCount = Number(row.likes_count) || 0;
  const commentsCount = Math.max(0, Number(row.comments_count ?? row.commentsCount ?? 0) || 0);
  const likedByMe = opts.likedByMe === true;
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
    photoDate:
      row.captured_at ||
      (row.exif_data && typeof row.exif_data === 'object' && row.exif_data.photoDate) ||
      row.created_at ||
      null,
    isInAppCamera: row.is_in_app_camera === true,
    exifData:
      row.exif_data && typeof row.exif_data === 'object'
        ? row.exif_data
        : null,
    coordinates:
      row.exif_data?.map_pin &&
      Number.isFinite(Number(row.exif_data.map_pin.lat)) &&
      Number.isFinite(Number(row.exif_data.map_pin.lng))
        ? { lat: Number(row.exif_data.map_pin.lat), lng: Number(row.exif_data.map_pin.lng) }
        : null,
    likes: likesCount,
    likeCount: likesCount,
    likedByMe,
    // 목록/피드에서는 댓글 본문을 들고 다니지 않고, 서버 기준 카운트만 사용한다.
    // 상세 화면에서만 post_comments 테이블을 조회해 실제 배열로 채운다.
    comments: Array.isArray(row.comments) ? row.comments : [],
    commentCount: commentsCount,
    commentsCount,
    category: row.category || null,
    categoryName: row.category_name || null,
    // 동영상만 있는 게시물에서 row.images 가 [] 일 때 || row.images 가 빈 배열이라 truthy여서
    // thumbnail 이 [] 로 내려가 캐러셀/썸네일 로직이 깨지지 않도록 첫 문자열 URL만 사용
    thumbnail: (() => {
      const imgs = Array.isArray(row.images) ? row.images : [];
      const first = imgs.find((x) => typeof x === 'string' && x.trim());
      return first || null;
    })(),
    weather: row.weather || null,
  };
};

export const fetchPostByIdSupabase = async (postId, currentUserId = null, opts = {}) => {
  if (!postId || typeof postId !== 'string') return null;
  const trimmed = postId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return null;
  const skipComments = opts?.skipComments === true;
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', trimmed)
      .maybeSingle();
    if (error || !data) return null;
    const likedSet = await fetchLikedPostIdsSupabase([trimmed], currentUserId);
    const mapped = mapSupabasePostRowToPost(data, { likedByMe: likedSet.has(trimmed) });
    if (skipComments) {
      return mapped ? { ...mapped, comments: mapped?.comments || [] } : null;
    }
    const liveComments = await fetchCommentsForPostSupabase(trimmed);
    const fromTable = Array.isArray(liveComments) && liveComments.length > 0
      ? liveComments.map((c) => ({
        id: String(c.id),
        userId: c.user_id ? String(c.user_id) : null,
        user: c.user_id ? { id: String(c.user_id), username: c.username || null, profileImage: c.avatar_url || null } : (c.username || '유저'),
        content: c.content || '',
        timestamp: c.created_at || new Date().toISOString(),
        createdAt: c.created_at || new Date().toISOString(),
        avatar: c.avatar_url || null,
      }))
      : (mapped?.comments || []);
    return mapped ? { ...mapped, comments: fromTable } : null;
  } catch (e) {
    logger.warn('fetchPostByIdSupabase 예외:', e?.message);
    return null;
  }
};

// Supabase 게시물에 댓글 추가 (DB 기준 추적)
export const addCommentToPostSupabase = async (postId, commentPayload) => {
  // (Deprecated) 기존 posts.comments 배열 업데이트 방식은 경합이 있어 사용하지 않습니다.
  // 호출부 호환을 위해 실패 반환.
  if (!postId || typeof postId !== 'string' || !commentPayload) return { success: false, comments: [] };
  const trimmed = postId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return { success: false, comments: [] };
  return { success: false, comments: [] };
};

// Supabase 게시물 댓글 목록 일괄 갱신 (수정·삭제 후 호출)
export const updateCommentsInPostSupabase = async (postId, commentsArray) => {
  // (Deprecated) 기존 posts.comments 배열 업데이트 방식은 경합이 있어 사용하지 않습니다.
  if (!postId || typeof postId !== 'string' || !Array.isArray(commentsArray)) return { success: false, comments: [] };
  const trimmed = postId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return { success: false, comments: [] };
  return { success: false, comments: [] };
};

// Supabase에서 특정 사용자(user_id)가 올린 게시물만 조회 (프로필 기록용, 로그아웃 후 재로그인해도 유지)
export const fetchPostsByUserIdSupabase = async (userId, currentUserId = null) => {
  if (!userId || typeof userId !== 'string') return [];
  const trimmed = userId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (!isUuid) return [];
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', trimmed)
      .or('category.is.null,category.neq.question')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    const ids = data.map((r) => r.id).filter(Boolean);
    const likedSet = await fetchLikedPostIdsSupabase(ids, currentUserId);
    return data.map((r) => mapSupabasePostRowToPost(r, { likedByMe: likedSet.has(String(r.id)) })).filter(Boolean);
  } catch (error) {
    logger.warn('Supabase fetchPostsByUserId 실패:', error?.message);
    return [];
  }
};

/** 뱃지/활동 통계용: 서버(Supabase) 기준으로만 내 게시물 조회 */
export const getMergedMyPostsForStats = async (userId) => {
  return await fetchPostsByUserIdSupabase(userId);
};

// Supabase에서 게시물 목록 읽기
export const fetchPostsSupabase = async (currentUserId = null) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .or('category.is.null,category.neq.question')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data) return [];

    const ids = data.map((r) => r.id).filter(Boolean);
    const likedSet = await fetchLikedPostIdsSupabase(ids, currentUserId);
    return data.map((r) => mapSupabasePostRowToPost(r, { likedByMe: likedSet.has(String(r.id)) })).filter(Boolean);
  } catch (error) {
    logger.warn('Supabase fetchPosts 실패:', error);
    return [];
  }
};

/**
 * 현지 상황 질문( category='question' ) 최신 N개 조회 (텍스트 섹션/리스트용)
 * - help_answer_accepts 존재 여부로 채택 완료 상태를 함께 내려준다.
 */
export const fetchQuestionPostsSupabase = async ({ limit = 4, currentUserId = null } = {}) => {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 4));
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('category', 'question')
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const ids = rows.map((r) => r.id).filter(Boolean);
    const likedSet = await fetchLikedPostIdsSupabase(ids, currentUserId);
    const mapped = rows.map((r) => mapSupabasePostRowToPost(r, { likedByMe: likedSet.has(String(r.id)) })).filter(Boolean);

    let acceptedSet = new Set();
    if (ids.length > 0) {
      const { data: acc } = await supabase
        .from('help_answer_accepts')
        .select('post_id')
        .in('post_id', ids);
      if (Array.isArray(acc)) acceptedSet = new Set(acc.map((x) => String(x.post_id)));
    }
    return mapped.map((p) => ({ ...p, hasAcceptedAnswer: acceptedSet.has(String(p.id)) }));
  } catch (e) {
    logger.warn('fetchQuestionPostsSupabase 실패:', e?.message);
    return [];
  }
};

/**
 * 현지 상황 질문 리스트 페이징 조회
 * @param {{ limit?: number, before?: string|null, currentUserId?: string|null }} opts
 * before: created_at 기준 커서(이 값보다 과거를 조회)
 */
export const fetchQuestionPostsPageSupabase = async ({ limit = 20, before = null, currentUserId = null } = {}) => {
  const safeLimit = Math.max(5, Math.min(50, Number(limit) || 20));
  try {
    let q = supabase
      .from('posts')
      .select('*')
      .eq('category', 'question')
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (before) {
      q = q.lt('created_at', before);
    }
    const { data, error } = await q;
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const ids = rows.map((r) => r.id).filter(Boolean);
    const likedSet = await fetchLikedPostIdsSupabase(ids, currentUserId);
    const mapped = rows.map((r) => mapSupabasePostRowToPost(r, { likedByMe: likedSet.has(String(r.id)) })).filter(Boolean);

    let acceptedSet = new Set();
    if (ids.length > 0) {
      const { data: acc } = await supabase
        .from('help_answer_accepts')
        .select('post_id')
        .in('post_id', ids);
      if (Array.isArray(acc)) acceptedSet = new Set(acc.map((x) => String(x.post_id)));
    }

    const out = mapped.map((p) => ({ ...p, hasAcceptedAnswer: acceptedSet.has(String(p.id)) }));
    const nextBefore = rows.length > 0 ? rows[rows.length - 1].created_at : null;
    return { posts: out, nextBefore };
  } catch (e) {
    logger.warn('fetchQuestionPostsPageSupabase 실패:', e?.message);
    return { posts: [], nextBefore: null };
  }
};


