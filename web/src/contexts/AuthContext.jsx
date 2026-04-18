import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { syncEarnedBadgesFromSupabase } from '../utils/badgeSystem';
import { syncNotificationsFromSupabase } from '../utils/notifications';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [localUserOverride, setLocalUserOverride] = useState(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  // Supabase 세션 초기화 + 상태 구독
  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error) {
          setSupabaseUser(data.user ?? null);
        }
      } catch (error) {
        logger.error('Supabase getUser 실패:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 우리 앱에서 쓰기 쉬운 user 형태로 변환
  const appUser = useMemo(() => {
    if (!supabaseUser) return null;
    const meta = supabaseUser.user_metadata || {};
    const email = supabaseUser.email || meta.email || '';
    const base = {
      id: supabaseUser.id,
      email,
      username: meta.name || email.split('@')[0] || '여행자',
      profileImage: meta.picture || meta.avatar_url || null,
      provider: supabaseUser.app_metadata?.provider || 'supabase',
    };
    const o = (localUserOverride && String(localUserOverride.id) === String(base.id)) ? localUserOverride : null;
    if (!o || typeof o !== 'object') return base;
    return {
      ...base,
      // 사용자가 편집한 값은 로컬 우선(새로고침 초기화 방지)
      username: o.username ?? base.username,
      profileImage: o.profileImage !== undefined ? o.profileImage : base.profileImage,
      bio: o.bio ?? base.bio,
      representativeBadge: o.representativeBadge ?? base.representativeBadge,
    };
  }, [supabaseUser, localUserOverride]);

  // localStorage 에 user 저장 (기존 코드와 호환을 위해)
  useEffect(() => {
    if (appUser) {
      localStorage.setItem('user', JSON.stringify(appUser));
    } else {
      localStorage.removeItem('user');
    }
  }, [appUser]);

  // 로그인 시 Supabase에서 뱃지·알림 동기화 (동일 계정이면 기기 간 동일 목록)
  useEffect(() => {
    if (appUser?.id) {
      syncEarnedBadgesFromSupabase(appUser.id);
      void syncNotificationsFromSupabase(appUser.id);
    }
  }, [appUser?.id]);

  const loginWithProvider = async (provider) => {
    try {
      const providerLower = provider.toLowerCase();
      logger.log(`🌐 Supabase OAuth 로그인 시작: ${providerLower}`);

      await supabase.auth.signInWithOAuth({
        provider: providerLower,
        options: {
          redirectTo: window.location.origin,
        },
      });
    } catch (error) {
      logger.error('Supabase OAuth 로그인 실패:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error('Supabase 로그아웃 실패:', error);
    }

    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.log('🚪 로그아웃 - 앱 초기화 시작');
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 기존 로직과 동일하게 localStorage/sessionStorage 초기화하되,
    // 뱃지 정보는 로그아웃 후에도 유지되도록 예외 처리
    const preservedKeys = ['earnedBadges'];
    const preservedValues = {};
    preservedKeys.forEach((key) => {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          preservedValues[key] = value;
        }
      } catch {
        // ignore
      }
    });

    localStorage.clear();

    Object.entries(preservedValues).forEach(([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore
      }
    });

    sessionStorage.clear();
    sessionStorage.setItem('justLoggedOut', 'true');
    logger.log('✅ 스토리지 초기화 완료');
  };

  const updateUser = useCallback(async (userObj) => {
    if (!userObj || typeof userObj !== 'object') return;
    try {
      localStorage.setItem('user', JSON.stringify(userObj));
    } catch {
      /* ignore */
    }
    setLocalUserOverride(userObj);

    // 로그인 사용자면 Supabase 메타데이터도 best-effort로 갱신(가능한 경우만)
    try {
      if (supabaseUser?.id && String(userObj.id) === String(supabaseUser.id)) {
        const nextMeta = {
          name: userObj.username,
          picture: userObj.profileImage && userObj.profileImage !== 'default' ? userObj.profileImage : null,
        };
        await supabase.auth.updateUser({ data: nextMeta });
      }
    } catch (e) {
      // 실패해도 로컬은 유지되어야 함
      logger.warn('Supabase user_metadata 업데이트 실패(로컬은 유지):', e);
    }
  }, [supabaseUser?.id]);

  // AuthCallbackScreen 과의 호환을 위한 setUser (실제로는 사용하지 않음)
  const setUserFromCallback = (userObj) => {
    if (!userObj) {
      setSupabaseUser(null);
      return;
    }
    // Supabase User와 구조가 다르지만, 최소한 localStorage 용도로만 저장
    localStorage.setItem('user', JSON.stringify(userObj));
    setLocalUserOverride(userObj);
  };

  const value = {
    user: appUser,
    authLoading,
    loginWithProvider,
    logout,
    isAuthenticated: !!appUser,
    updateUser,
    // 구 코드 호환용
    setUser: setUserFromCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};












