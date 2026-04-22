import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { syncEarnedBadgesFromSupabase } from '../utils/badgeSystem';
import { syncNotificationsFromSupabase } from '../utils/notifications';
import { setCurrentUserId as setFollowSystemCurrentUserId, syncFollowingFromSupabase } from '../utils/followSystem';

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
  const [localUserOverride, setLocalUserOverride] = useState(null);

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

  // 서버 운영 전환: localStorage에 user 저장/복원 로직 제거

  // 로그인 시 Supabase에서 뱃지·알림 동기화 (동일 계정이면 기기 간 동일 목록)
  useEffect(() => {
    if (appUser?.id) {
      setFollowSystemCurrentUserId(appUser.id);
      syncEarnedBadgesFromSupabase(appUser.id);
      void syncNotificationsFromSupabase(appUser.id);
      // 팔로우 목록도 DB 기준으로 동기화(멀티기기 일관성)
      void syncFollowingFromSupabase(appUser.id);
    } else {
      setFollowSystemCurrentUserId(null);
    }
  }, [appUser?.id]);

  // ✅ 실시간 상호작용 알림(좋아요/댓글/팔로우) 반영: notifications 테이블 insert/update를 구독
  // - 상대방이 보낸 알림이 DB에 들어오면 즉시 localStorage 캐시를 갱신하고 배지 카운트를 업데이트한다.
  // - 정책/RLS에 따라 select 권한이 없으면 동기화가 실패할 수 있으니 best-effort로 처리한다.
  useEffect(() => {
    const uid = appUser?.id ? String(appUser.id) : '';
    const isUuid = uid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);
    if (!isUuid) return undefined;

    let alive = true;
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${uid}` },
        async () => {
          if (!alive) return;
          try {
            await syncNotificationsFromSupabase(uid);
          } catch (e) {
            logger.warn('notifications realtime sync 실패:', e?.message);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.warn('notifications realtime 채널 에러');
        }
      });

    return () => {
      alive = false;
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [appUser?.id]);

  const loginWithProvider = async (provider) => {
    try {
      const providerLower = provider.toLowerCase();
      logger.log(`🌐 Supabase OAuth 로그인 시작: ${providerLower}`);

      const siteUrl =
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PUBLIC_SITE_URL
          ? String(import.meta.env.VITE_PUBLIC_SITE_URL).trim()
          : '') || 'https://livejourney.co.kr';

      await supabase.auth.signInWithOAuth({
        provider: providerLower,
        options: {
          // OAuth 콜백은 별도 라우트에서 code→session 교환을 처리한다.
          // (일부 환경에서 root로 리다이렉트되면 세션이 안정적으로 잡히기 전에 화면 전환이 일어나 로그인 화면으로 되돌아가는 문제가 발생할 수 있음)
          redirectTo: `${siteUrl.replace(/\/+$/, '')}/auth/callback`,
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

    logger.log('✅ 로그아웃 완료');
  };

  const updateUser = useCallback(async (userObj) => {
    if (!userObj || typeof userObj !== 'object') return;
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
    setLocalUserOverride(userObj);
  };

  const value = {
    user: appUser,
    // ExifConsent 등에서 user_metadata를 읽기 위한 원본 user도 노출 (권한 판단에는 사용 금지)
    supabaseUser: supabaseUser,
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












