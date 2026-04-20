import { useEffect, useMemo, useState } from 'react';
import EXIF from 'exif-js';

export type PhotoStatus = 'LIVE' | 'VERIFIED' | 'NONE';

export type PrefetchedExifBundle = {
  fileKey: string;
  /** extractExifData 결과 또는 추출 불가 시 null */
  exif: {
    photoDate?: string | null;
    dateTimeOriginalRaw?: string | null;
  } | null;
};

type UsePhotoValidationParams = {
  file: File | null | undefined;
  isInAppCamera: boolean;
  /** EXIF 읽기 동의 여부 */
  exifAllowed: boolean;
  /** 첫 이미지에 대해 EXIF 파싱 진행 중 */
  exifExtracting?: boolean;
  /** Upload 화면에서 이미 추출한 EXIF(파일 키 일치 시에만 유효) */
  prefetchedExif: PrefetchedExifBundle | null;
  /** 편집 모드: 로컬 파일 없이 서버에만 있는 촬영일 */
  serverPhotoDateIso?: string | null;
  now?: () => number;
};

export type UsePhotoValidationResult = {
  status: PhotoStatus;
  loading: boolean;
  capturedAt: Date | null;
  dateTimeOriginalRaw: string | null;
};

const HOURS_30_MS = 30 * 60 * 60 * 1000;
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

function statusFromCaptureDate(date: Date | null, nowMs: number): PhotoStatus {
  if (!date || Number.isNaN(date.getTime())) return 'NONE';
  const diff = nowMs - date.getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'NONE';
  if (diff <= LIVE_WINDOW_MS) return 'LIVE';
  return diff <= HOURS_30_MS ? 'VERIFIED' : 'NONE';
}

function parseExifDateTimeOriginal(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  // exif-js: "YYYY:MM:DD HH:MM:SS"
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se)
    );
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

async function readDateTimeOriginalWithExifJs(file: File): Promise<{ date: Date | null; raw: string | null }> {
  try {
    const buffer = await file.arrayBuffer();
    const tags = EXIF.readFromBinaryFile(buffer);
    const raw = tags?.DateTimeOriginal ?? tags?.DateTimeDigitized ?? tags?.DateTime ?? null;
    const rawText = raw != null ? String(raw) : null;
    const date = parseExifDateTimeOriginal(raw);
    return { date, raw: rawText };
  } catch {
    return { date: null, raw: null };
  }
}

export function usePhotoValidation(params: UsePhotoValidationParams): UsePhotoValidationResult {
  const {
    file,
    isInAppCamera,
    exifAllowed,
    exifExtracting = false,
    prefetchedExif,
    serverPhotoDateIso = null,
    now = () => Date.now(),
  } = params;

  const fileKey = useMemo(
    () => (file ? `${file.name}:${file.size}:${file.lastModified}` : ''),
    [file]
  );

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PhotoStatus>('NONE');
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [dateTimeOriginalRaw, setDateTimeOriginalRaw] = useState<string | null>(null);

  useEffect(() => {
    if (isInAppCamera) {
      setLoading(false);
      // 업로드 직후에는 현장 LIVE로 보이되, 저장/피드에서는 촬영시각 기준으로 자연스럽게 다운그레이드된다.
      setStatus('LIVE');
      setCapturedAt(new Date(now()));
      setDateTimeOriginalRaw(null);
      return;
    }

    if (!exifAllowed) {
      setLoading(false);
      setStatus('NONE');
      setCapturedAt(null);
      setDateTimeOriginalRaw(null);
      return;
    }

    if (!file) {
      setLoading(false);
      if (serverPhotoDateIso) {
        const d = new Date(serverPhotoDateIso);
        if (!Number.isNaN(d.getTime())) {
          setCapturedAt(d);
          setDateTimeOriginalRaw(null);
          setStatus(statusFromCaptureDate(d, now()));
        } else {
          setCapturedAt(null);
          setStatus('NONE');
        }
      } else {
        setCapturedAt(null);
        setDateTimeOriginalRaw(null);
        setStatus('NONE');
      }
      return;
    }

    // UploadScreen에서 EXIF 전체 파싱(exifr)을 하는 동안에도, 배지 검증(exif-js)은 별도 진행할 수 있지만
    // UX 상 "촬영 정보 확인 중..."은 EXIF 파싱/검증이 끝날 때까지 유지한다.
    if (exifExtracting) {
      setLoading(true);
      setStatus('NONE');
      setCapturedAt(null);
      setDateTimeOriginalRaw(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStatus('NONE');
    setCapturedAt(null);
    setDateTimeOriginalRaw(null);

    (async () => {
      const preferred = prefetchedExif && prefetchedExif.fileKey === fileKey ? prefetchedExif.exif : null;
      const preferredRaw = preferred?.dateTimeOriginalRaw ?? null;
      const preferredDate = preferred?.photoDate ? new Date(preferred.photoDate) : null;
      const preferredOk = !!(preferredDate && !Number.isNaN(preferredDate.getTime()));

      // extractExifData(exifr)로 이미 촬영 시각을 얻었으면 전체 파일을 다시 읽지 않는다.
      if (preferredOk) {
        if (cancelled) return;
        setLoading(false);
        setDateTimeOriginalRaw(preferredRaw);
        setCapturedAt(preferredDate);
        setStatus(statusFromCaptureDate(preferredDate, now()));
        return;
      }

      const exifJs = await readDateTimeOriginalWithExifJs(file);
      if (cancelled) return;
      setLoading(false);
      setDateTimeOriginalRaw(exifJs.raw);
      setCapturedAt(exifJs.date);
      setStatus(statusFromCaptureDate(exifJs.date, now()));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fileKey,
    file,
    isInAppCamera,
    exifAllowed,
    exifExtracting,
    prefetchedExif,
    serverPhotoDateIso,
    now,
  ]);

  return { status, loading, capturedAt, dateTimeOriginalRaw };
}
