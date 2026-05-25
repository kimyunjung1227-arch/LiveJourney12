import { useCallback, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { getWeatherByCoords } from '../api/weather';
import { logger } from '../utils/logger';

const BUCKET = 'post-images';
const LJ_CATEGORY_LABEL = {
  nature: '개화·자연',
  weather: '날씨·체감',
  event: '이벤트·축제',
  crowd: '혼잡도·대기',
  sunset: '노을·야경',
  business: '영업·운영',
};

/** Blob/File에서 storage 경로 확장자 추론 */
function extOf(file) {
  if (!file) return 'jpg';
  if (file.type?.startsWith('video/')) {
    if (file.type.includes('mp4')) return 'mp4';
    if (file.type.includes('webm')) return 'webm';
    return 'webm';
  }
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * 단일 파일을 Storage 에 업로드하고 public URL 반환.
 */
async function uploadOneFile(file, userId) {
  const ext = extOf(file);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${userId}/${filename}`;
  const contentType = file.type || (file.type?.startsWith('video/') ? 'video/webm' : 'image/jpeg');

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

/**
 * 업로드 훅 — 단일/다중 파일 묶음 업로드.
 *
 * 호출 형태 (둘 다 지원):
 *   upload({ file, ... })           // 단일
 *   upload({ files: File[], ... }) // 다중 (한 게시물에 캐러셀)
 *
 * 결과: 만들어진 단일 post id.
 */
export function useUpload() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = useCallback(
    async ({
      file,
      files,
      category,
      body,
      takenAt,
      lat,
      lng,
      placeName,
      region,
      source,
      mode,
      accuracy,
      exif,
    }) => {
      if (!user) throw new Error('로그인이 필요해요');
      const fileList = Array.isArray(files) && files.length > 0 ? files : file ? [file] : [];
      if (fileList.length === 0) throw new Error('파일이 없어요');

      setIsUploading(true);
      setError(null);
      try {
        // 1) Storage 병렬 업로드 (한 게시물 묶음)
        const urls = await Promise.all(fileList.map((f) => uploadOneFile(f, user.id)));
        const isVideo = (mode || '') === 'video';
        const imageUrls = isVideo ? [] : urls;
        const videoUrls = isVideo ? urls : [];

        // 2) posts insert
        const capturedIso =
          takenAt instanceof Date
            ? takenAt.toISOString()
            : typeof takenAt === 'string' && takenAt
              ? new Date(takenAt).toISOString()
              : new Date().toISOString();

        const categoryName = category ? LJ_CATEGORY_LABEL[category] || category : null;
        const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
        const exifData = {
          taken_at: capturedIso,
          photoDate: capturedIso,
          lat: lat ?? null,
          lng: lng ?? null,
          map_pin: hasCoords ? { lat: Number(lat), lng: Number(lng) } : null,
          gps_accuracy_m: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
          source,
          mode,
          uploaded_via: 'lj-camera-flow-v2',
          tags: exif && typeof exif === 'object' ? exif : null,
          photo_count: fileList.length,
        };

        const row = {
          user_id: user.id,
          content: body || '',
          images: imageUrls,
          videos: videoUrls,
          location: placeName || null,
          place_name: placeName || null,
          region: region || null,
          category: category || null,
          category_name: categoryName,
          captured_at: capturedIso,
          is_in_app_camera: source === 'camera',
          exif_data: exifData,
          author_username:
            (typeof user?.username === 'string' && user.username.trim()) ||
            user.user_metadata?.nickname ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            '익명',
          author_avatar_url:
            (typeof user?.profileImage === 'string' && user.profileImage !== 'default' && user.profileImage) ||
            user.user_metadata?.picture ||
            user.user_metadata?.avatar_url ||
            null,
          // 신규 RPC 가 photo_url 컬럼을 읽으므로 첫 컷을 대표로 세팅
          photo_url: imageUrls[0] || null,
          exif_taken_at: capturedIso,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('posts')
          .insert(row)
          .select('id')
          .single();
        if (insertError) throw insertError;

        // weather 스냅샷은 best-effort
        if (hasCoords) {
          (async () => {
            try {
              const w = await getWeatherByCoords(Number(lat), Number(lng), { at: capturedIso });
              if (!w?.success || !w?.weather) return;
              const weatherSnapshot = {
                ...w.weather,
                observedAt: capturedIso,
                source: 'kma_ultra_ncst_coord',
                coord: { lat: Number(lat), lng: Number(lng) },
              };
              const { error: weatherErr } = await supabase
                .from('posts')
                .update({ weather: weatherSnapshot })
                .eq('id', inserted.id);
              if (weatherErr) {
                logger.warn('weather 업데이트 실패(무시):', weatherErr?.message || weatherErr);
              }
            } catch (e) {
              logger.warn('useUpload 날씨 스냅샷 실패:', e?.message || e);
            }
          })();
        }

        return inserted.id;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setIsUploading(false);
      }
    },
    [user]
  );

  return { isUploading, error, upload };
}
