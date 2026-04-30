import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchProfileByIdSupabase, updateExifConsentSupabase } from '../api/profilesSupabase';
import { logger } from '../utils/logger';

const ExifConsentContext = createContext(null);

export function ExifConsentProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [consent, setConsent] = useState(null);
  /** 로그인 사용자에 대해 profiles에서 동의 여부를 불러오는 중 */
  const [consentLoading, setConsentLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setConsent(null);
      setConsentLoading(false);
      return;
    }

    let cancelled = false;
    setConsentLoading(true);

    void (async () => {
      try {
        const row = await fetchProfileByIdSupabase(userId);
        if (cancelled) return;
        const v = row?.exif_consent;
        if (v === 'granted' || v === 'declined') {
          setConsent(v);
        } else {
          setConsent(null);
        }
      } catch (e) {
        if (!cancelled) {
          logger.warn('EXIF 동의 프로필 조회 실패:', e?.message || e);
          setConsent(null);
        }
      } finally {
        if (!cancelled) setConsentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const grant = useCallback(async () => {
    if (!userId) return;
    setConsent('granted');
    const res = await updateExifConsentSupabase(userId, 'granted');
    if (!res.ok) {
      logger.warn('EXIF 동의 저장(granted) 실패');
      const row = await fetchProfileByIdSupabase(userId);
      const v = row?.exif_consent;
      setConsent(v === 'granted' || v === 'declined' ? v : null);
    }
  }, [userId]);

  const decline = useCallback(async () => {
    if (!userId) return;
    setConsent('declined');
    const res = await updateExifConsentSupabase(userId, 'declined');
    if (!res.ok) {
      logger.warn('EXIF 동의 저장(declined) 실패');
      const row = await fetchProfileByIdSupabase(userId);
      const v = row?.exif_consent;
      setConsent(v === 'granted' || v === 'declined' ? v : null);
    }
  }, [userId]);

  const value = useMemo(
    () => ({
      /** EXIF 읽기에 동의했는지 */
      exifAllowed: consent === 'granted',
      consentResolved: consent !== null,
      /** profiles 동기화 전에는 시트를 숨겨 깜빡임 방지 */
      consentLoading,
      grantExifConsent: grant,
      declineExifConsent: decline,
    }),
    [consent, consentLoading, grant, decline]
  );

  return <ExifConsentContext.Provider value={value}>{children}</ExifConsentContext.Provider>;
}

export function useExifConsent() {
  const ctx = useContext(ExifConsentContext);
  if (!ctx) {
    throw new Error('useExifConsent는 ExifConsentProvider 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}
