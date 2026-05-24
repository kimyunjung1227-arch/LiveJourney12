/**
 * 업로드 흐름 3화면(CameraScreen → UploadInfoScreen → UploadCompleteScreen)
 * 간 미디어 데이터 핸드오프.
 *
 * - 내부 상태는 항상 { medias: MediaItem[], ...rest } 형태. (다중 사진 묶음 업로드)
 * - 화면 일부는 아직 "단일 media" 호환 API 를 쓰고 있어서 getUploadSnapshot() 은
 *   첫 번째 media 의 평탄화된 필드(file/url/lat/...) + medias 배열을 함께 반환한다.
 *   → 기존 코드가 깨지지 않고 점진 마이그레이션 가능.
 * - 메모리 + sessionStorage 백업: 새로고침해도 메타데이터는 유지되며, blob URL/File 은
 *   직렬화 불가라 메모리 신뢰. (새로고침 후엔 medias 가 비어 있어 카메라로 유도됨)
 */

const SS_KEY = 'lj:uploadStore';
// 한 게시물에 첨부할 수 있는 미디어 상한 — 사실상 무제한으로 두되 메모리·성능을 위해 안전한 큰 값
const MAX_MEDIAS = 100;

let state = readFromSession();
let cachedProjection;        // 직전에 만든 projection 결과
let cachedProjectionFrom;    // 그때의 state 레퍼런스 (변경 감지)
const listeners = new Set();

function readFromSession() {
  // ⚠️ File 과 blob: URL 은 새로고침 후 살아남지 못한다.
  //   - File: 직렬화 불가 (애초에 저장 안 함)
  //   - blob:URL: 페이지 reload 시 자동 무효화 → <img src="blob:..."> 는 ERR_FILE_NOT_FOUND
  // 따라서 복원 시 medias 는 무조건 비워서 카메라 진입을 유도한다.
  // (sessionStorage 키는 단순 폴백 컨테이너로만 유지)
  if (typeof sessionStorage === 'undefined') return null;
  try {
    sessionStorage.removeItem(SS_KEY);
  } catch (_) {}
  return null;
}

function writeToSession(next) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (next) sessionStorage.setItem(SS_KEY, JSON.stringify(stripBlobsFromState(next)));
    else sessionStorage.removeItem(SS_KEY);
  } catch (_) {}
}

function stripBlobsFromState(s) {
  if (!s) return s;
  const out = { ...s };
  if (Array.isArray(out.medias)) {
    // file + url(blob:) 둘 다 새로고침 후 무효라 직렬화 제외
    out.medias = out.medias.map(({ file, url, ...rest }) => rest);
  }
  return out;
}

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch (_) {}
  }
}

/**
 * 화면에서 쓰기 편하도록 첫 번째 media 의 필드를 평탄화해서 함께 노출.
 * - medias 배열은 항상 포함 (다중 사진 UI 가 사용)
 * - 첫 번째 media 의 file/url/lat/lng/... 등이 최상위에 평탄화됨 (단일 media 가정 코드 호환)
 *
 * ⚠️ useSyncExternalStore 가 동일성 검사로 변경 감지를 하므로, state 가 같으면 같은 객체를 반환해야 한다.
 */
function projectSnapshot(s) {
  if (!s || !Array.isArray(s.medias) || s.medias.length === 0) return null;
  const head = s.medias[0];
  return {
    ...head,
    medias: s.medias,
  };
}

export function getUploadSnapshot() {
  if (cachedProjectionFrom !== state) {
    cachedProjection = projectSnapshot(state);
    cachedProjectionFrom = state;
  }
  return cachedProjection;
}

export function subscribeUploadStore(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 미디어 1건 설정 (= medias 배열을 길이 1로 교체). 기존 호출부 호환용.
 * payload 가 falsy 면 reset 과 동일.
 */
export function setUploadMedia(payload) {
  if (!payload) {
    resetUploadStore();
    return;
  }
  state = { medias: [payload] };
  writeToSession(state);
  emit();
}

/**
 * 첫 번째 media 에 부분 업데이트 (좌표/장소 갱신 등 단일 가정 코드 호환).
 */
export function patchUploadMedia(patch) {
  if (!state || !patch) return;
  if (!Array.isArray(state.medias) || state.medias.length === 0) return;
  const next = [...state.medias];
  next[0] = { ...next[0], ...patch };
  state = { ...state, medias: next };
  writeToSession(state);
  emit();
}

/**
 * 묶음에 새 미디어 추가. MAX_MEDIAS 초과분은 무시.
 * payload 는 단일 객체 또는 객체 배열.
 */
export function appendUploadMedias(payload) {
  if (!payload) return;
  const arr = Array.isArray(payload) ? payload : [payload];
  const prev = state && Array.isArray(state.medias) ? state.medias : [];
  const merged = [...prev, ...arr].slice(0, MAX_MEDIAS);
  state = { ...(state || {}), medias: merged };
  writeToSession(state);
  emit();
}

/**
 * index 위치의 미디어 제거. blob URL 도 회수.
 */
export function removeUploadMediaAt(index) {
  if (!state || !Array.isArray(state.medias)) return;
  const target = state.medias[index];
  if (target?.url) {
    try {
      URL.revokeObjectURL(target.url);
    } catch (_) {}
  }
  const next = state.medias.filter((_, i) => i !== index);
  if (next.length === 0) {
    resetUploadStore();
    return;
  }
  state = { ...state, medias: next };
  writeToSession(state);
  emit();
}

export function resetUploadStore() {
  if (state && Array.isArray(state.medias)) {
    for (const m of state.medias) {
      if (m?.url) {
        try {
          URL.revokeObjectURL(m.url);
        } catch (_) {}
      }
    }
  }
  state = null;
  writeToSession(null);
  emit();
}

export const UPLOAD_MAX_MEDIAS = MAX_MEDIAS;
