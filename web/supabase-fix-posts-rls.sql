-- posts 테이블 42501 (RLS 위반) 해결
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run

-- 기존 정책 제거
DROP POLICY IF EXISTS allow_public_insert ON public.posts;
DROP POLICY IF EXISTS allow_public_select ON public.posts;

-- anon이 아무 행이나 INSERT 가능 (WITH CHECK (true))
CREATE POLICY allow_public_insert ON public.posts
  FOR INSERT TO anon
  WITH CHECK (true);

-- anon이 모든 행 SELECT 가능
CREATE POLICY allow_public_select ON public.posts
  FOR SELECT TO anon
  USING (true);
