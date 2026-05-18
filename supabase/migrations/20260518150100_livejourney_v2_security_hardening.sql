-- Live Journey v2 보안 경고 수정
-- Supabase advisor 지적사항:
--   1. lj_live_count 뷰가 SECURITY DEFINER로 만들어져 호출자 RLS를 우회 (ERROR)
--   2. 신규 trigger/helper 함수 5개의 search_path가 mutable (WARN)

-- 뷰는 호출자 RLS를 따라야 한다 (security_invoker)
drop view if exists public.lj_live_count;
create view public.lj_live_count
  with (security_invoker = true) as
  select count(*)::integer as live_count
  from public.lj_posts
  where expires_at > now();

grant select on public.lj_live_count to anon, authenticated;

-- 함수 search_path를 고정해 검색 경로 변조를 차단
alter function public.lj_posts_set_expires_at() set search_path = public, pg_temp;
alter function public.lj_comments_enforce_depth() set search_path = public, pg_temp;
alter function public.lj_comments_bump_counter() set search_path = public, pg_temp;
alter function public.lj_reactions_bump_counter() set search_path = public, pg_temp;
alter function public.lj_author_helped_count(uuid) set search_path = public, pg_temp;
