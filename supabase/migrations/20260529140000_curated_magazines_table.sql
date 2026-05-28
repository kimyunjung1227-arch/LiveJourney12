-- 큐레이션 매거진 (트리플 가이드 스타일)
-- - 커버 이미지 + 인트로 + blocks (text / place 블록 JSON 배열)
-- - status: draft (관리자만), published (모두에게)

create table if not exists public.curated_magazines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  cover_image_url text,
  intro_body text,
  blocks jsonb not null default '[]'::jsonb,
  region text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  author_id uuid references auth.users(id) on delete set null,
  display_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_curated_magazines_status_published
  on public.curated_magazines (status, published_at desc nulls last);
create index if not exists idx_curated_magazines_region
  on public.curated_magazines (region);

alter table public.curated_magazines enable row level security;

drop policy if exists curated_magazines_select_published on public.curated_magazines;
create policy curated_magazines_select_published on public.curated_magazines
  for select using (status = 'published');

drop policy if exists curated_magazines_admin_all_select on public.curated_magazines;
create policy curated_magazines_admin_all_select on public.curated_magazines
  for select to authenticated using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

drop policy if exists curated_magazines_admin_insert on public.curated_magazines;
create policy curated_magazines_admin_insert on public.curated_magazines
  for insert to authenticated with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

drop policy if exists curated_magazines_admin_update on public.curated_magazines;
create policy curated_magazines_admin_update on public.curated_magazines
  for update to authenticated using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

drop policy if exists curated_magazines_admin_delete on public.curated_magazines;
create policy curated_magazines_admin_delete on public.curated_magazines
  for delete to authenticated using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

create or replace function public.curated_magazines_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists curated_magazines_touch on public.curated_magazines;
create trigger curated_magazines_touch
  before update on public.curated_magazines
  for each row execute function public.curated_magazines_touch_updated_at();
