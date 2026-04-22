import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const POST_IMAGES_BUCKET = 'post-images';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

function safeExtFromUri(uri, fallback = 'jpg') {
  const s = String(uri || '');
  const m = s.match(/\.([a-zA-Z0-9]+)(\?|#|$)/);
  const ext = (m && m[1] ? String(m[1]).toLowerCase() : '') || '';
  if (!ext) return fallback;
  if (ext.length > 8) return fallback;
  return ext;
}

function mimeFromExt(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === 'mp4' || e === 'm4v') return 'video/mp4';
  if (e === 'mov' || e === 'qt') return 'video/quicktime';
  if (e === 'webm') return 'video/webm';
  if (e === '3gp' || e === '3gpp') return 'video/3gpp';
  return '';
}

async function uploadUriToStorage({ uri, userId, prefix, fallbackExt = 'jpg' }) {
  if (!isSupabaseConfigured() || !supabase) throw new Error('supabase_not_configured');
  const cleanUri = String(uri || '').trim();
  if (!cleanUri) throw new Error('no_uri');

  const ext = safeExtFromUri(cleanUri, fallbackExt);
  const uid = isValidUuid(String(userId || '')) ? String(userId).trim() : 'anon';
  const path = `${prefix}/${uid}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const resp = await fetch(cleanUri);
  const blob = await resp.blob();

  const videoHint = mimeFromExt(ext);
  const contentType = blob?.type || videoHint || (fallbackExt === 'jpg' ? 'image/jpeg' : undefined);

  const { error: upErr } = await supabase
    .storage
    .from(POST_IMAGES_BUCKET)
    .upload(path, blob, {
      upsert: false,
      contentType: contentType || undefined,
    });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(path);
  return data?.publicUrl ? String(data.publicUrl) : null;
}

export async function fetchPostsSupabase() {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createPostSupabase({ user, formData }) {
  if (!isSupabaseConfigured() || !supabase) throw new Error('supabase_not_configured');
  const uid = user?.id && isValidUuid(String(user.id)) ? String(user.id).trim() : null;
  const username = user?.username ? String(user.username) : null;

  const imageUris = Array.isArray(formData?.images) ? formData.images : [];
  const videoUris = Array.isArray(formData?.videos) ? formData.videos : [];

  const uploadOne = async (uri, prefix, fallbackExt) => {
    try {
      return await uploadUriToStorage({ uri, userId: uid, prefix, fallbackExt });
    } catch (e) {
      console.warn('Storage 업로드 실패:', prefix, e?.message || e);
      return null;
    }
  };

  const [uploadedImages, uploadedVideos] = await Promise.all([
    Promise.all(imageUris.map((uri) => uploadOne(uri, 'uploads', 'jpg'))),
    Promise.all(videoUris.map((uri) => uploadOne(uri, 'videos', 'mp4'))),
  ]);

  const payload = {
    user_id: uid,
    author_username: username,
    author_avatar_url: null,
    content: String(formData?.note || '').trim(),
    images: uploadedImages.filter(Boolean),
    videos: uploadedVideos.filter(Boolean),
    location: formData?.location ? String(formData.location) : null,
    detailed_location: formData?.detailedLocation ? String(formData.detailedLocation) : (formData?.location ? String(formData.location) : null),
    place_name: formData?.placeName ? String(formData.placeName) : null,
    region: (() => {
      const loc = String(formData?.location || '').trim();
      return loc ? loc.split(' ')[0] : null;
    })(),
    weather: formData?.weatherSnapshot || formData?.weather || null,
    tags: Array.isArray(formData?.tags) ? formData.tags.map((t) => String(t).replace(/^#+/, '')) : [],
    category: formData?.aiCategory ? String(formData.aiCategory) : null,
    category_name: formData?.aiCategoryName ? String(formData.aiCategoryName) : null,
    is_in_app_camera: formData?.isInAppCamera === true,
    exif_data: formData?.coordinates ? { map_pin: formData.coordinates } : null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('posts').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

