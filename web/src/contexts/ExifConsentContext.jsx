import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ExifConsentModal from '../components/ExifConsentModal';
import { useAuth } from './AuthContext';
import { supabase } from '../utils/supabaseClient';

const ExifConsentContext = createContext(null);

export function ExifConsentProvider({ children }) {
  const { isAuthenticated, supabaseUser } = useAuth();

  // 계정당 1회만 노출: Supabase Auth user_metadata에 저장
  const meta = supabaseUser?.user_metadata || {};
  const resolvedFromMeta = meta?.exif_consent_resolved === true;
  const grantedFromMeta = meta?.exif_consent === 'granted';
  const declinedFromMeta = meta?.exif_consent === 'declined';

  const [consent, setConsent] = useState(
    resolvedFromMeta ? (grantedFromMeta ? 'granted' : (declinedFromMeta ? 'declined' : 'declined')) : null
  );
  const [modalOpen, setModalOpen] = useState(false);

  // 로그인 상태가 잡힌 뒤에만(메타 확인 가능) 1회 노출 판단
  useEffect(() => {
    if (!isAuthenticated) {
      setModalOpen(false);
      setConsent(null);
      return;
    }
    if (resolvedFromMeta) {
      setConsent(grantedFromMeta ? 'granted' : 'declined');
      setModalOpen(false);
      return;
    }
    setConsent(null);
    setModalOpen(true);
  }, [isAuthenticated, resolvedFromMeta, grantedFromMeta]);

  const grant = useCallback(() => {
    setConsent('granted');
    setModalOpen(false);
    // user_metadata에 best-effort로 기록 (권한 판단/보안 로직에는 사용 금지)
    void supabase.auth.updateUser({
      data: {
        exif_consent_resolved: true,
        exif_consent: 'granted',
        exif_consent_at: new Date().toISOString(),
      },
    });
  }, []);

  const decline = useCallback(() => {
    setConsent('declined');
    setModalOpen(false);
    void supabase.auth.updateUser({
      data: {
        exif_consent_resolved: true,
        exif_consent: 'declined',
        exif_consent_at: new Date().toISOString(),
      },
    });
  }, []);

  const value = useMemo(
    () => ({
      /** EXIF 읽기에 동의했는지 (명시적 거부면 false) */
      exifAllowed: consent === 'granted',
      consentResolved: consent !== null,
      showConsentModal: modalOpen,
      grantExifConsent: grant,
      declineExifConsent: decline,
    }),
    [consent, modalOpen, grant, decline]
  );

  return (
    <ExifConsentContext.Provider value={value}>
      {children}
      {modalOpen && <ExifConsentModal onGrant={grant} onDecline={decline} />}
    </ExifConsentContext.Provider>
  );
}

export function useExifConsent() {
  const ctx = useContext(ExifConsentContext);
  if (!ctx) {
    throw new Error('useExifConsent는 ExifConsentProvider 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}
