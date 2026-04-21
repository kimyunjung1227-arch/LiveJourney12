-- 관리자 계정 테이블 (Supabase 대시보드에서 user_id 추가하여 관리자 지정)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 공지사항 테이블
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT '공지',
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- admin_users: 본인 행만 조회 가능 (관리자 여부 확인용)
DROP POLICY IF EXISTS admin_users_select_own ON public.admin_users;
CREATE POLICY admin_users_select_own ON public.admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- notices: 모든 사용자 읽기 가능
DROP POLICY IF EXISTS notices_select_all ON public.notices;
CREATE POLICY notices_select_all ON public.notices
  FOR SELECT USING (true);

-- notices: admin_users에 있는 사용자만 삽입/수정/삭제
DROP POLICY IF EXISTS notices_insert_admin ON public.notices;
CREATE POLICY notices_insert_admin ON public.notices
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS notices_update_admin ON public.notices;
CREATE POLICY notices_update_admin ON public.notices
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS notices_delete_admin ON public.notices;
CREATE POLICY notices_delete_admin ON public.notices
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- updated_at 자동 갱신
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

-- posts 테이블: 로그인한 관리자 또는 작성자만 삭제 가능 (admin_users 생성 후 적용)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_authenticated_post_delete ON public.posts;
CREATE POLICY allow_authenticated_post_delete ON public.posts
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
    OR auth.uid() = user_id
  );

-- posts: 좋아요 수 갱신용 UPDATE 허용
DROP POLICY IF EXISTS allow_post_likes_update ON public.posts;
CREATE POLICY allow_post_likes_update ON public.posts
  FOR UPDATE USING (true) WITH CHECK (true);

-- 참고: 관리자 지정은 Supabase 대시보드 SQL Editor에서
-- INSERT INTO public.admin_users (user_id) VALUES ('로그인한 사용자 UUID');
-- 로 추가할 수 있습니다. 또는 앱에서 VITE_ADMIN_EMAILS 환경변수로 이메일 지정 가능합니다.
