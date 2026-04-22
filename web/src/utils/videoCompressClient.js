import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { logger } from './logger';

/** 같은 세션에서 코어 wasm 로드 1회만 */
let ffmpegLoadPromise = null;

async function loadFFmpeg(signal) {
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load(
      {
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      },
      { signal }
    );
    return ffmpeg;
  })().catch((e) => {
    ffmpegLoadPromise = null;
    throw e;
  });
  return ffmpegLoadPromise;
}

function isProbablyMobile() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent || '');
}

/**
 * 업로드 전 동영상을 H.264/AAC MP4로 줄입니다 (용량·Storage 한도 회피).
 * 실패 시 원본 파일을 그대로 반환합니다.
 *
 * @param {File|Blob} file
 * @param {{ onProgress?: (n: number) => void, signal?: AbortSignal }} [opts]
 * @returns {Promise<File>}
 */
export async function compressVideoForUpload(file, opts = {}) {
  const { onProgress, signal } = opts;
  if (!file || !(file instanceof Blob)) return file;

  const disable =
    typeof import.meta !== 'undefined' &&
    String(import.meta.env?.VITE_DISABLE_VIDEO_COMPRESS || '').trim() === 'true';
  if (disable) return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });

  const mobile = isProbablyMobile();
  const size = Number(file.size) || 0;
  // 너무 작으면 스킵 (인코딩 비용만 듦)
  if (size > 0 && size < 2.5 * 1024 * 1024) return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });
  // 모바일이거나 8MB 초과일 때만 시도
  if (!mobile && size > 0 && size < 8 * 1024 * 1024) return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });
  // 극대용량은 wasm 메모리 한계 → 원본 시도(실패 시 사용자 안내는 업로드 쪽)
  if (size > 380 * 1024 * 1024) {
    logger.warn('동영상이 너무 커 클라이언트 압축을 건너뜁니다.');
    return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });
  }

  let ffmpeg;
  try {
    ffmpeg = await loadFFmpeg(signal);
  } catch (e) {
    logger.warn('FFmpeg 로드 실패, 원본 업로드 시도:', e?.message || e);
    return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });
  }

  if (signal?.aborted) return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });

  const onProg = ({ progress }) => {
    if (typeof onProgress === 'function') {
      const p = typeof progress === 'number' ? Math.min(0.99, Math.max(0, progress)) : 0;
      onProgress(p);
    }
  };
  ffmpeg.on('progress', onProg);

  const extMatch = file instanceof File && file.name ? file.name.match(/(\.[^.]+)$/) : null;
  const ext = (extMatch && extMatch[1] ? extMatch[1] : '.mp4').toLowerCase();
  const inputName = `in${ext}`;
  const outName = 'out.mp4';

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const maxW = mobile ? 854 : 1280;
    const crf = mobile ? '30' : '27';

    const args = [
      '-i',
      inputName,
      '-vf',
      `scale='min(${maxW},iw)':-2`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      crf,
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      '-y',
      outName,
    ];

    const code = await ffmpeg.exec(args, undefined, { signal });
    if (code !== 0) throw new Error(`ffmpeg_exit_${code}`);

    const data = await ffmpeg.readFile(outName);
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const blob = new Blob([u8], { type: 'video/mp4' });
    const baseName =
      file instanceof File && file.name
        ? file.name.replace(/\.[^.]+$/, '')
        : 'video';
    const outFile = new File([blob], `${baseName}.mp4`, {
      type: 'video/mp4',
      lastModified: Date.now(),
    });

    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});

    if (outFile.size >= size * 0.98 && size > 5 * 1024 * 1024) {
      logger.log('압축 후에도 용량이 비슷해 원본을 사용합니다.');
      return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });
    }

    if (typeof onProgress === 'function') onProgress(1);
    return outFile;
  } catch (e) {
    logger.warn('동영상 압축 실패, 원본 업로드 시도:', e?.message || e);
    try {
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outName).catch(() => {});
    } catch (_) {}
    return file instanceof File ? file : new File([file], 'video.mp4', { type: 'video/mp4' });
  } finally {
    try {
      ffmpeg.off('progress', onProg);
    } catch (_) {}
  }
}
