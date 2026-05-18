/**
 * 업로드 흐름 3화면(CameraScreen → UploadInfoScreen → UploadCompleteScreen)
 * 간 미디어 데이터 핸드오프.
 *
 * - 메모리 + sessionStorage 백업: 새로고침해도 미디어 메타데이터는 유지되며,
 *   blob URL은 페이지 리로드 시 무효라 메모리만 신뢰한다.
 * - 구독 API(subscribe/getSnapshot)를 제공해 useSyncExternalStore로 React에
 *   바인딩할 수 있게 함.
 */

const SS_KEY = 'lj:uploadStore';

let state = readFromSession();
const listeners = new Set();

function readFromSession() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // blob URL은 세션 새로고침 후 유효성을 보장 못함 — 메타데이터만 보존
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeToSession(next) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (next) sessionStorage.setItem(SS_KEY, JSON.stringify(stripBlob(next)));
    else sessionStorage.removeItem(SS_KEY);
  } catch (_) {}
}

function stripBlob(s) {
  if (!s) return s;
  const { file, ...rest } = s;
  return rest; // File/Blob은 직렬화 불가
}

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch (_) {}
  }
}

export function getUploadSnapshot() {
  return state;
}

export function subscribeUploadStore(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 미디어 설정. payload 예시:
 * {
 *   file: Blob | File,
 *   url: string,           // URL.createObjectURL(file)
 *   source: 'camera' | 'gallery',
 *   mode: 'photo' | 'video',
 *   mimeType: string,
 *   size: number,
 *   takenAt: string,       // ISO
 *   lat: number | null,
 *   lng: number | null,
 *   accuracy: number | null,
 *   placeName: string | null,
 *   facingMode: 'environment' | 'user' | null,
 * }
 */
export function setUploadMedia(payload) {
  state = payload || null;
  writeToSession(state);
  emit();
}

export function resetUploadStore() {
  if (state?.url) {
    try {
      URL.revokeObjectURL(state.url);
    } catch (_) {}
  }
  state = null;
  writeToSession(null);
  emit();
}
