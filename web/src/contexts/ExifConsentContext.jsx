import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ExifConsentModal from '../components/ExifConsentModal';

// 서버 운영 전환: localStorage 제거 → 세션 내에서만 유지
function readStoredConsent() {
  return null;
}

const ExifConsentContext = createContext(null);

export function ExifConsentProvider({ children }) {
  const [consent, setConsent] = useState(() => readStoredConsent());
  const [modalOpen, setModalOpen] = useState(() => readStoredConsent() === null);

  const grant = useCallback(() => {
    setConsent('granted');
    setModalOpen(false);
  }, []);

  const decline = useCallback(() => {
    setConsent('declined');
    setModalOpen(false);
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
