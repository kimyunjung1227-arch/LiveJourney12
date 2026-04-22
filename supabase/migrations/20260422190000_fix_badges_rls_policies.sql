-- Fix: client upsert into public.badges returns 403 when RLS policies are missing.
-- Allow public read; allow authenticated insert/update for badges.

alter table if exists public.badges enable row level security;

-- SELECT for everyone (anon+authenticated)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='badges' and policyname='badges_select_all'
  ) then
    create policy badges_select_all on public.badges
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- INSERT for authenticated
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='badges' and policyname='badges_insert_authenticated'
  ) then
    create policy badges_insert_authenticated on public.badges
      for insert
      to authenticated
      with check (true);
  end if;
end $$;

-- UPDATE for authenticated (needed for upsert)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='badges' and policyname='badges_update_authenticated'
  ) then
    create policy badges_update_authenticated on public.badges
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

