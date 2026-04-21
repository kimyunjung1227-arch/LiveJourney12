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

async function uploadUriToStorage({ uri, userId, prefix }) {
  if (!isSupabaseConfigured() || !supabase) throw new Error('supabase_not_configured');
  const cleanUri = String(uri || '').trim();
  if (!cleanUri) throw new Error('no_uri');

  const ext = safeExtFromUri(cleanUri, 'jpg');
  const uid = isValidUuid(String(userId || '')) ? String(userId).trim() : 'anon';
  const path = `${prefix}/${uid}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const resp = await fetch(cleanUri);
  const blob = await resp.blob();

  const { error: upErr } = await supabase
    .storage
    .from(POST_IMAGES_BUCKET)
    .upload(path, blob, {
      upsert: false,
      contentType: blob?.type || undefined,
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

  // MVP: 이미지 업로드 우선. 비디오는 path만 저장(추후 확장)
  const uploadedImages = [];
  for (const uri of imageUris) {
    // eslint-disable-next-line no-await-in-loop
    const url = await uploadUriToStorage({ uri, userId: uid, prefix: 'uploads' });
    if (url) uploadedImages.push(url);
  }

  const payload = {
    user_id: uid,
    author_username: username,
    author_avatar_url: null,
    content: String(formData?.note || '').trim(),
    images: uploadedImages, // jsonb(array)로 들어감
    videos: videoUris.length ? videoUris : [], // 일단 그대로 저장(대부분 로컬 uri라 다른 기기에서는 안 보임)
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

