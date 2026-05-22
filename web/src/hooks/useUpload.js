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
 * 업로드 훅.
 * @returns {{
 *   isUploading: boolean,
 *   error: Error | null,
 *   upload: (args: {
 *     file: Blob,
 *     category: string | null,        // lj_category id
 *     body: string,
 *     takenAt: string | Date | null,
 *     lat: number | null,
 *     lng: number | null,
 *     placeName: string | null,
 *     source: 'camera' | 'gallery',
 *     mode: 'photo' | 'video',
 *   }) => Promise<string>             // returns postId
 * }}
 */
export function useUpload() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = useCallback(
    async ({
      file,
      category,
      body,
      takenAt,
      lat,
      lng,
      placeName,
      source,
      mode,
      accuracy,
      exif,
    }) => {
      if (!user) throw new Error('로그인이 필요해요');
      if (!file) throw new Error('파일이 없어요');

      setIsUploading(true);
      setError(null);
      try {
        // 1) Storage 업로드
        const ext = extOf(file);
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const path = `${user.id}/${filename}`;
        const contentType = file.type || (mode === 'video' ? 'video/webm' : 'image/jpeg');

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType, upsert: false });
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(path);

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
          // 지도 화면 RPC가 읽는 정규화 경로
          map_pin: hasCoords ? { lat: Number(lat), lng: Number(lng) } : null,
          gps_accuracy_m: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
          source, // 'camera' | 'gallery'
          mode,   // 'photo' | 'video'
          uploaded_via: 'lj-camera-flow-v2',
          // 추출한 EXIF 원본 메타 (gallery: 카메라 기종/시간/GPS 등, camera: 인앱)
          tags: exif && typeof exif === 'object' ? exif : null,
        };

        // 좌표가 있으면 기상청 초단기실황(좌표 기반) 호출하여 weather 스냅샷 저장
        let weatherSnapshot = null;
        if (hasCoords) {
          try {
            const w = await getWeatherByCoords(Number(lat), Number(lng), { at: capturedIso });
            if (w?.success && w?.weather) {
              weatherSnapshot = {
                ...w.weather,
                observedAt: capturedIso,
                source: 'kma_ultra_ncst_coord',
                coord: { lat: Number(lat), lng: Number(lng) },
              };
            }
          } catch (e) {
            logger.warn('useUpload 날씨 스냅샷 실패:', e?.message || e);
          }
        }

        const row = {
          user_id: user.id,
          content: body || '',
          images: mode === 'photo' ? [publicUrl] : [],
          videos: mode === 'video' ? [publicUrl] : [],
          location: placeName || null,
          place_name: placeName || null,
          category: category || null,
          category_name: categoryName,
          captured_at: capturedIso,
          is_in_app_camera: source === 'camera',
          exif_data: exifData,
          weather: weatherSnapshot,
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
          // 신규 RPC(get_question_detail, get_city_detail 등)는 photo_url 컬럼을 읽으므로 함께 세팅
          photo_url: mode === 'photo' ? publicUrl : null,
          exif_taken_at: capturedIso,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('posts')
          .insert(row)
          .select('id')
          .single();
        if (insertError) throw insertError;

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
