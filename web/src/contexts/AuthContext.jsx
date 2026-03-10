import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { syncEarnedBadgesFromSupabase } from '../utils/badgeSystem';

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
    return {
      id: supabaseUser.id,
      email,
      username: meta.name || email.split('@')[0] || '여행자',
      profileImage: meta.picture || meta.avatar_url || null,
      provider: supabaseUser.app_metadata?.provider || 'supabase',
    };
  }, [supabaseUser]);

  // localStorage 에 user 저장 (기존 코드와 호환을 위해)
  useEffect(() => {
    if (appUser) {
      localStorage.setItem('user', JSON.stringify(appUser));
    } else {
      localStorage.removeItem('user');
    }
  }, [appUser]);

  // 로그인 시 Supabase에서 뱃지 목록 동기화 (로그아웃 후 재로그인해도 획득 뱃지 유지)
  useEffect(() => {
    if (appUser?.id) {
      syncEarnedBadgesFromSupabase(appUser.id);
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

  // AuthCallbackScreen 과의 호환을 위한 setUser (실제로는 사용하지 않음)
  const setUserFromCallback = (userObj) => {
    if (!userObj) {
      setSupabaseUser(null);
      return;
    }
    // Supabase User와 구조가 다르지만, 최소한 localStorage 용도로만 저장
    localStorage.setItem('user', JSON.stringify(userObj));
  };

  const value = {
    user: appUser,
    authLoading,
    loginWithProvider,
    logout,
    isAuthenticated: !!appUser,
    // 구 코드 호환용
    setUser: setUserFromCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};












