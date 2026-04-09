import { useEffect, useMemo, useState } from 'react';
import EXIF from 'exif-js';

export type PhotoStatus = 'LIVE' | 'VERIFIED' | 'NONE';

type UsePhotoValidationParams = {
  file: File | null | undefined;
  isInAppCamera: boolean;
  now?: () => number;
};

export type UsePhotoValidationResult = {
  status: PhotoStatus;
  loading: boolean;
  capturedAt: Date | null;
  dateTimeOriginalRaw: string | null;
};

const HOURS_48_MS = 48 * 60 * 60 * 1000;

function parseExifDateTimeOriginal(raw: unknown): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Common EXIF format: "YYYY:MM:DD HH:MM:SS"
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const isoLike = `${y}-${mo}-${d}T${h}:${mi}:${se}`;
  const dt = new Date(isoLike);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

async function readDateTimeOriginalFromExifJs(file: File): Promise<{ raw: string | null; date: Date | null }> {
  return await new Promise((resolve) => {
    try {
      EXIF.getData(file, function () {
        const rawValue =
          EXIF.getTag(this, 'DateTimeOriginal') ??
          EXIF.getTag(this, 'CreateDate') ??
          EXIF.getTag(this, 'DateTime') ??
          null;
        const raw = rawValue == null ? null : String(rawValue);
        resolve({ raw, date: parseExifDateTimeOriginal(raw) });
      });
    } catch (_) {
      resolve({ raw: null, date: null });
    }
  });
}

export function usePhotoValidation(params: UsePhotoValidationParams): UsePhotoValidationResult {
  const { file, isInAppCamera, now = () => Date.now() } = params;
  const fileKey = useMemo(() => (file ? `${file.name}:${file.size}:${file.lastModified}` : ''), [file]);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PhotoStatus>('NONE');
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [dateTimeOriginalRaw, setDateTimeOriginalRaw] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isInAppCamera) {
        setLoading(false);
        setStatus('LIVE');
        setCapturedAt(new Date(now()));
        setDateTimeOriginalRaw(null);
        return;
      }

      if (!file) {
        setLoading(false);
        setStatus('NONE');
        setCapturedAt(null);
        setDateTimeOriginalRaw(null);
        return;
      }

      setLoading(true);
      const { raw, date } = await readDateTimeOriginalFromExifJs(file);

      if (cancelled) return;

      setDateTimeOriginalRaw(raw);
      setCapturedAt(date);

      if (!date) {
        setStatus('NONE');
        setLoading(false);
        return;
      }

      const diff = Math.abs(now() - date.getTime());
      setStatus(diff <= HOURS_48_MS ? 'VERIFIED' : 'NONE');
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey, isInAppCamera]);

  return { status, loading, capturedAt, dateTimeOriginalRaw };
}

