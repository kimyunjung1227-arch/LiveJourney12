-- 매거진(seasonal_highlights) 관리자 RLS 정책
-- - SELECT 는 누구나 (기존 seasonal_select 유지)
-- - INSERT/UPDATE/DELETE 는 admin_users 에 등록된 사용자만

drop policy if exists seasonal_insert_admin on public.seasonal_highlights;
drop policy if exists seasonal_update_admin on public.seasonal_highlights;
drop policy if exists seasonal_delete_admin on public.seasonal_highlights;

create policy seasonal_insert_admin on public.seasonal_highlights
  for insert
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

create policy seasonal_update_admin on public.seasonal_highlights
  for update
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

create policy seasonal_delete_admin on public.seasonal_highlights
  for delete
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );
