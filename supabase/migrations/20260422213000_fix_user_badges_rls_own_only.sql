-- Fix: user_badges must be per-account (no public insert/select).

alter table if exists public.user_badges enable row level security;

-- Drop overly-permissive policies (created during beta)
drop policy if exists user_badges_insert_all on public.user_badges;
drop policy if exists user_badges_select_all on public.user_badges;
drop policy if exists user_badges_insert_own on public.user_badges;
drop policy if exists user_badges_select_own on public.user_badges;

-- Own-only policies for authenticated
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_badges' and policyname='user_badges_select_own_authenticated'
  ) then
    create policy user_badges_select_own_authenticated on public.user_badges
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_badges' and policyname='user_badges_insert_own_authenticated'
  ) then
    create policy user_badges_insert_own_authenticated on public.user_badges
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Upsert uses UPDATE path when conflict hits
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_badges' and policyname='user_badges_update_own_authenticated'
  ) then
    create policy user_badges_update_own_authenticated on public.user_badges
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

