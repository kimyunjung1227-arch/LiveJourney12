import { useEffect, useMemo, useState } from 'react';

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

const HOURS_48_MS = 48 * 60 * 60 * 1000;

function statusFromCaptureDate(date: Date | null, nowMs: number): PhotoStatus {
  if (!date || Number.isNaN(date.getTime())) return 'NONE';
  const diff = Math.abs(nowMs - date.getTime());
  return diff <= HOURS_48_MS ? 'VERIFIED' : 'NONE';
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

    if (exifExtracting) {
      setLoading(true);
      setStatus('NONE');
      setCapturedAt(null);
      setDateTimeOriginalRaw(null);
      return;
    }

    const bundle = prefetchedExif;
    const match = bundle && bundle.fileKey === fileKey;

    if (!match) {
      setLoading(false);
      setStatus('NONE');
      setCapturedAt(null);
      setDateTimeOriginalRaw(null);
      return;
    }

    setLoading(false);

    if (!bundle.exif) {
      setStatus('NONE');
      setCapturedAt(null);
      setDateTimeOriginalRaw(null);
      return;
    }

    const raw = bundle.exif.dateTimeOriginalRaw ?? null;
    setDateTimeOriginalRaw(raw);

    const pd = bundle.exif.photoDate;
    const date = pd ? new Date(pd) : null;
    if (!date || Number.isNaN(date.getTime())) {
      setCapturedAt(null);
      setStatus('NONE');
      return;
    }

    setCapturedAt(date);
    setStatus(statusFromCaptureDate(date, now()));
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
