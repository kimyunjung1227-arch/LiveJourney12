import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ExifConsentModal from '../components/ExifConsentModal';
import { useAuth } from './AuthContext';
import { supabase } from '../utils/supabaseClient';

const ExifConsentContext = createContext(null);

const LOCAL_KEY = 'lj_exif_consent_v1'; // { resolved: boolean, value: 'granted'|'declined', at: iso }

const safeReadLocal = () => {
  try {
    if (typeof window === 'undefined' || !window?.localStorage) return null;
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const resolved = parsed.resolved === true;
    const value = parsed.value === 'granted' || parsed.value === 'declined' ? parsed.value : null;
    if (!resolved || !value) return null;
    return { resolved, value, at: parsed.at || null };
  } catch {
    return null;
  }
};

const safeWriteLocal = (value) => {
  try {
    if (typeof window === 'undefined' || !window?.localStorage) return;
    const v = value === 'granted' ? 'granted' : 'declined';
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ resolved: true, value: v, at: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
};

export function ExifConsentProvider({ children }) {
  const { isAuthenticated, supabaseUser } = useAuth();

  // 계정당 1회만 노출: Supabase Auth user_metadata에 저장
  const meta = supabaseUser?.user_metadata || {};
  const resolvedFromMeta = meta?.exif_consent_resolved === true;
  const grantedFromMeta = meta?.exif_consent === 'granted';
  const declinedFromMeta = meta?.exif_consent === 'declined';

  const local = safeReadLocal();
  const resolvedFromLocal = local?.resolved === true;
  const grantedFromLocal = local?.value === 'granted';
  const declinedFromLocal = local?.value === 'declined';

  const [consent, setConsent] = useState(
    resolvedFromMeta
      ? (grantedFromMeta ? 'granted' : (declinedFromMeta ? 'declined' : 'declined'))
      : (resolvedFromLocal ? (grantedFromLocal ? 'granted' : 'declined') : null)
  );
  const [modalOpen, setModalOpen] = useState(false);

  // 로그인 상태가 잡힌 뒤에만(메타 확인 가능) 1회 노출 판단
  useEffect(() => {
    // 비로그인 상태에서도 "브라우저 1회 동의"를 받을 수 있게 한다.
    if (resolvedFromMeta) {
      setConsent(grantedFromMeta ? 'granted' : 'declined');
      setModalOpen(false);
      return;
    }
    if (resolvedFromLocal) {
      setConsent(grantedFromLocal ? 'granted' : 'declined');
      setModalOpen(false);
      return;
    }
    setConsent(null);
    setModalOpen(true);
  }, [isAuthenticated, resolvedFromMeta, grantedFromMeta, resolvedFromLocal, grantedFromLocal]);

  const grant = useCallback(() => {
    setConsent('granted');
    setModalOpen(false);
    safeWriteLocal('granted');
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
    safeWriteLocal('declined');
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
