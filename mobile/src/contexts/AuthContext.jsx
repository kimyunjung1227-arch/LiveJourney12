import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/axios';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // AsyncStorage에서 사용자 정보 로드 (Supabase 세션 우선)
    const loadUser = async () => {
      try {
        if (isSupabaseConfigured() && supabase) {
          const { data } = await supabase.auth.getSession();
          const sUser = data?.session?.user;
          if (sUser) {
            const profile = {
              id: sUser.id,
              email: sUser.email,
              username:
                (sUser.user_metadata && (sUser.user_metadata.username || sUser.user_metadata.full_name)) ||
                (sUser.email ? sUser.email.split('@')[0] : '여행자'),
            };
            await AsyncStorage.setItem('user', JSON.stringify(profile));
            setUser(profile);
            setLoading(false);
            return;
          }
        }

        const token = await AsyncStorage.getItem('token');
        const savedUser = await AsyncStorage.getItem('user');

        if (token && savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  const login = async (email, password) => {
    try {
      // Supabase Auth 우선
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: String(email || '').trim(),
          password: String(password || ''),
        });
        if (error) throw error;
        const sUser = data?.user;
        if (!sUser) throw new Error('no_user');
        const profile = {
          id: sUser.id,
          email: sUser.email,
          username:
            (sUser.user_metadata && (sUser.user_metadata.username || sUser.user_metadata.full_name)) ||
            (sUser.email ? sUser.email.split('@')[0] : '여행자'),
        };
        await AsyncStorage.setItem('token', 'supabase');
        await AsyncStorage.setItem('user', JSON.stringify(profile));
        setUser(profile);
        return { success: true };
      }

      const response = await api.post('/users/login', { email, password });
      const { token, user } = response.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      return { success: true };
    } catch (error) {
      // 백엔드가 없을 때를 위한 Mock 로그인
      console.warn('백엔드 연결 실패, Mock 모드로 전환');
      
      try {
        const savedUsersJson = await AsyncStorage.getItem('mock_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];
        const foundUser = savedUsers.find(u => u.email === email && u.password === password);
        
        if (foundUser) {
          const mockUser = {
            id: foundUser.id,
            email: foundUser.email,
            username: foundUser.username,
            points: foundUser.points || 5000,
            badges: foundUser.badges || []
          };
          
          await AsyncStorage.setItem('token', 'mock_token_' + Date.now());
          await AsyncStorage.setItem('user', JSON.stringify(mockUser));
          setUser(mockUser);
          
          return { success: true };
        }
      } catch (e) {
        console.error('Mock 로그인 실패:', e);
      }
      
      return {
        success: false,
        error: '이메일 또는 비밀번호가 일치하지 않습니다.'
      };
    }
  };

  const signup = async (email, password, username) => {
    try {
      // Supabase Auth 우선
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: String(email || '').trim(),
          password: String(password || ''),
          options: {
            data: { username: String(username || '').trim() || undefined },
          },
        });
        if (error) throw error;
        const sUser = data?.user;
        // 이메일 확인을 켠 프로젝트면 세션이 아직 없을 수 있음. 그래도 user 저장은 해둔다.
        const profile = sUser
          ? {
              id: sUser.id,
              email: sUser.email,
              username: String(username || '').trim() || (sUser.email ? sUser.email.split('@')[0] : '여행자'),
            }
          : { id: null, email: String(email || '').trim(), username: String(username || '').trim() || '여행자' };
        await AsyncStorage.setItem('token', 'supabase');
        await AsyncStorage.setItem('user', JSON.stringify(profile));
        setUser(profile?.id ? profile : null);
        return { success: true };
      }

      const response = await api.post('/users/signup', { email, password, username });
      const { token, user } = response.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      return { success: true };
    } catch (error) {
      // 백엔드가 없을 때를 위한 Mock 회원가입
      console.warn('백엔드 연결 실패, Mock 모드로 전환');
      
      try {
        const savedUsersJson = await AsyncStorage.getItem('mock_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];
        
        // 이메일 중복 체크
        if (savedUsers.find(u => u.email === email)) {
          return {
            success: false,
            error: '이미 사용 중인 이메일입니다.'
          };
        }
        
        // 새 사용자 생성
        const newUser = {
          id: 'user_' + Date.now(),
          email,
          password, // 실제로는 암호화해야 하지만 Mock이므로 생략
          username,
          points: 5000, // 초기 포인트
          badges: [],
          createdAt: new Date().toISOString()
        };
        
        savedUsers.push(newUser);
        await AsyncStorage.setItem('mock_users', JSON.stringify(savedUsers));
        
        const mockUser = {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          points: newUser.points,
          badges: newUser.badges
        };
        
        await AsyncStorage.setItem('token', 'mock_token_' + Date.now());
        await AsyncStorage.setItem('user', JSON.stringify(mockUser));
        setUser(mockUser);
        
        return { success: true };
      } catch (e) {
        console.error('Mock 회원가입 실패:', e);
        return {
          success: false,
          error: '회원가입 중 오류가 발생했습니다.'
        };
      }
    }
  };

  const logout = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚪 로그아웃 - 앱 완전 초기화 시작...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.auth.signOut();
        } catch (_) {}
      }

      // AsyncStorage 완전 삭제
      await AsyncStorage.clear();
      console.log('✅ AsyncStorage 완전 삭제 완료!');
    } catch (error) {
      console.error('AsyncStorage 삭제 실패:', error);
    }
    
    setUser(null);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 완전 초기화 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const updateUser = async (updatedUser) => {
    setUser(updatedUser);
    try {
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      if (isSupabaseConfigured() && supabase && updatedUser?.id) {
        // best-effort: user_metadata 업데이트(웹/모바일 표시명 통일용)
        const desired = String(updatedUser?.username || '').trim();
        if (desired) {
          try {
            await supabase.auth.updateUser({ data: { username: desired } });
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('사용자 정보 업데이트 실패:', error);
    }
  };

  const socialLogin = (provider) => {
    // 소셜 로그인은 웹뷰나 외부 브라우저로 처리
    // React Native에서는 Linking API 사용
    const apiUrl = __DEV__ ? 'http://localhost:5000' : 'https://your-api-server.com';
    // 실제 구현 시 Linking.openURL 사용
    console.log(`${provider} 로그인: ${apiUrl}/api/auth/${provider.toLowerCase()}`);
  };

  // 테스터 계정으로 바로 로그인
  const testerLogin = async () => {
    try {
      const testerEmail = 'tester@livejourney.com';
      const testerPassword = 'tester123';
      const testerUsername = '테스터';

      // ✅ Supabase가 설정돼 있으면 Supabase Auth로 테스터 계정 로그인(웹/모바일 uid 통일)
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: testerEmail,
            password: testerPassword,
          });
          if (error) throw error;
          const sUser = data?.user;
          if (!sUser) throw new Error('no_user');
          const profile = {
            id: sUser.id,
            email: sUser.email,
            username:
              (sUser.user_metadata && (sUser.user_metadata.username || sUser.user_metadata.full_name)) ||
              testerUsername,
          };
          await AsyncStorage.setItem('token', 'supabase');
          await AsyncStorage.setItem('user', JSON.stringify(profile));
          setUser(profile);
          return { success: true };
        } catch (e) {
          // 없으면 가입 후 로그인 시도
          try {
            await supabase.auth.signUp({
              email: testerEmail,
              password: testerPassword,
              options: { data: { username: testerUsername } },
            });
          } catch (_) {}
          const { data, error } = await supabase.auth.signInWithPassword({
            email: testerEmail,
            password: testerPassword,
          });
          if (error) throw error;
          const sUser = data?.user;
          if (!sUser) throw new Error('no_user');
          const profile = {
            id: sUser.id,
            email: sUser.email,
            username:
              (sUser.user_metadata && (sUser.user_metadata.username || sUser.user_metadata.full_name)) ||
              testerUsername,
          };
          await AsyncStorage.setItem('token', 'supabase');
          await AsyncStorage.setItem('user', JSON.stringify(profile));
          setUser(profile);
          return { success: true };
        }
      }

      // 먼저 실제 API 시도
      try {
        const response = await api.post('/users/login', { 
          email: testerEmail, 
          password: testerPassword 
        });
        const { token, user } = response.data;

        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        setUser(user);

        return { success: true };
      } catch (apiError) {
        // API 실패 시 Mock 모드로 전환
        console.warn('백엔드 연결 실패, 테스터 계정 Mock 모드로 전환');
        
        // Mock 사용자 생성 또는 기존 사용자 사용
        const savedUsersJson = await AsyncStorage.getItem('mock_users');
        const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];
        
        let testerUser = savedUsers.find(u => u.email === testerEmail);
        
        if (!testerUser) {
          // 테스터 계정 생성
          testerUser = {
            id: 'tester_' + Date.now(),
            email: testerEmail,
            password: testerPassword,
            username: testerUsername,
            points: 10000,
            badges: ['테스터'],
            createdAt: new Date().toISOString()
          };
          
          savedUsers.push(testerUser);
          await AsyncStorage.setItem('mock_users', JSON.stringify(savedUsers));
        }
        
        const mockUser = {
          id: testerUser.id,
          email: testerUser.email,
          username: testerUser.username,
          points: testerUser.points,
          badges: testerUser.badges
        };
        
        await AsyncStorage.setItem('token', 'mock_token_tester_' + Date.now());
        await AsyncStorage.setItem('user', JSON.stringify(mockUser));
        setUser(mockUser);
        
        return { success: true };
      }
    } catch (error) {
      console.error('테스터 로그인 실패:', error);
      return {
        success: false,
        error: '테스터 계정 로그인에 실패했습니다.'
      };
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    updateUser,
    socialLogin,
    testerLogin,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

