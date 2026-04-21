import { createClient } from '@supabase/supabase-js';

// 배포 환경에서 VITE_* env가 누락되면 Supabase가 완전히 비활성화되어
// 좋아요/댓글/알림 등 write가 전부 동작하지 않음.
// anon key는 공개 키이므로(클라이언트용) "안전한 기본값"을 두어 배포 실수를 흡수한다.
const DEFAULT_SUPABASE_URL = 'https://donxoyznlahewufadamu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbnhveXpubGFoZXd1ZmFkYW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTI5MTksImV4cCI6MjA4ODI4ODkxOX0.I4eyi7w8E41QX8Zr064E1MOWPJXX7U7NTi7zSIlvems';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim() || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim() || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // PKCE 콜백 교환은 /auth/callback에서만 단일 처리한다.
    // (자동 처리 + 수동 교환이 겹치면 code/code_verifier 경합으로 400이 발생할 수 있음)
    detectSessionInUrl: false,
  },
});

