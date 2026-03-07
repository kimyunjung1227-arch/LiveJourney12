-- ============================================================
-- Supabase 한 번에 설정
-- Supabase 대시보드 → SQL Editor에서 이 파일 전체를 복사해 Run 하세요.
-- (게시물 저장 오류, RLS, 관리자·공지·좋아요·댓글 추적까지 모두 포함)
-- ※ 좋아요/댓글이 쌓이지 않으면 이 스크립트를 한 번 더 실행해 주세요.
-- ============================================================

-- --------------------------------------------------------------
-- 1) posts 테이블 수정 (저장 오류 방지)
-- --------------------------------------------------------------
-- user_id nullable (23502 방지)
ALTER TABLE public.posts ALTER COLUMN user_id DROP NOT NULL;

-- user_id FK 제거 (23503: auth.users와 연동 시 public.users 미사용)
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;

-- 댓글 저장용 컬럼 (없으면 추가)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

-- 작성자 표시명·프로필 이미지 (게시물 상세에서 '익명 여행자' 대신 실제 이름 표시)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS author_username TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;

-- --------------------------------------------------------------
-- 2) posts RLS — 기존 정책 제거 후 재생성
-- --------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_public_insert ON public.posts;
DROP POLICY IF EXISTS allow_public_select ON public.posts;
DROP POLICY IF EXISTS allow_public_delete ON public.posts;
DROP POLICY IF EXISTS allow_authenticated_post_delete ON public.posts;
DROP POLICY IF EXISTS allow_post_likes_update ON public.posts;

-- anon: 게시물 등록·조회·삭제
CREATE POLICY allow_public_insert ON public.posts
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY allow_public_select ON public.posts
  FOR SELECT TO anon USING (true);

CREATE POLICY allow_public_delete ON public.posts
  FOR DELETE TO anon USING (true);

-- --------------------------------------------------------------
-- 3) 관리자·공지 테이블
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT '공지',
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- admin_users: 본인 행만 조회
DROP POLICY IF EXISTS admin_users_select_own ON public.admin_users;
CREATE POLICY admin_users_select_own ON public.admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- notices: 모두 읽기, 관리자만 쓰기/수정/삭제
DROP POLICY IF EXISTS notices_select_all ON public.notices;
CREATE POLICY notices_select_all ON public.notices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS notices_insert_admin ON public.notices;
CREATE POLICY notices_insert_admin ON public.notices
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS notices_update_admin ON public.notices;
CREATE POLICY notices_update_admin ON public.notices
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS notices_delete_admin ON public.notices;
CREATE POLICY notices_delete_admin ON public.notices
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- notices updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.set_notices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notices_updated_at ON public.notices;
CREATE TRIGGER notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE PROCEDURE public.set_notices_updated_at();

-- --------------------------------------------------------------
-- 4) posts 추가 정책 (관리자/작성자 삭제, 좋아요 수 갱신)
-- --------------------------------------------------------------
-- 로그인한 관리자 또는 작성자만 삭제 가능 (admin_users 존재 시 적용)
CREATE POLICY allow_authenticated_post_delete ON public.posts
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
    OR auth.uid() = user_id
  );

-- 좋아요 수 갱신용 UPDATE 허용
CREATE POLICY allow_post_likes_update ON public.posts
  FOR UPDATE USING (true) WITH CHECK (true);

-- --------------------------------------------------------------
-- 5) user_badges — 뱃지 획득 기록 (로그아웃/재로그인 후에도 유지)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID NOT NULL,
  badge_name TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  region TEXT,
  PRIMARY KEY (user_id, badge_name)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_badges_select_own ON public.user_badges;
CREATE POLICY user_badges_select_own ON public.user_badges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS user_badges_insert_own ON public.user_badges;
CREATE POLICY user_badges_insert_own ON public.user_badges
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 관리자 추가 방법 (둘 중 하나 선택)
-- ============================================================
-- 방법 1) Supabase 대시보드 → Authentication → Users 에서
--         관리자로 지정할 사용자의 UUID를 복사한 뒤 아래 실행
--         INSERT INTO public.admin_users (user_id) VALUES ('복사한-UUID-여기');
--
-- 방법 2) 앱 .env에 다음 추가 후 해당 이메일로 로그인한 사용자가 관리자
--         VITE_ADMIN_EMAILS=admin@example.com,another@example.com
-- ============================================================
