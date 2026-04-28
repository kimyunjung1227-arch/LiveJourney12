-- LiveJourney: Supabase 스키마(게시물/매거진/프로필) + RLS (멀티기기 동기화용)
-- Supabase Dashboard → SQL Editor에서 "전체를 그대로" 실행하세요.
-- 실행 순서:
-- 1) 이 파일(supabase-setup.sql)
-- 2) web/supabase-social-setup.sql (좋아요/댓글/팔로우/알림 등)

create extension if not exists pgcrypto;

-- ============================================================
-- 0) public.users (프로필) — 없으면 생성
--    ⚠️ 현재 당신이 붙여넣은 RLS/트리거 SQL은 public.users 테이블이 없으면 여기서 에러로 멈춥니다.
--    "에러로 중간에 멈추면" 뒤쪽(posts/magazines/policy)이 적용되지 않아 다른 기기에서 안 보이는 증상이 남습니다.
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  username text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_all" on public.users;
create policy "users_select_all" on public.users
for select to anon, authenticated using (true);

-- 회원가입 시 public.users 프로필 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(excluded.username, public.users.username),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 1) posts — 프론트(postsSupabase.js)가 기대하는 컬럼을 확정
-- ============================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  author_username text null,
  author_avatar_url text null,
  content text not null default '',
  images text[] not null default '{}'::text[],
  videos text[] not null default '{}'::text[],
  location text null,
  detailed_location text null,
  place_name text null,
  region text null,
  weather jsonb null,
  tags text[] not null default '{}'::text[],
  category text null,
  category_name text null,
  likes_count integer not null default 0,
  comments jsonb not null default '[]'::jsonb,
  captured_at timestamptz null,
  created_at timestamptz not null default now()
);

-- 기존 테이블 보강(누락 컬럼 추가)
alter table public.posts add column if not exists weather jsonb null;
alter table public.posts add column if not exists images text[] not null default '{}'::text[];
alter table public.posts add column if not exists videos text[] not null default '{}'::text[];
alter table public.posts add column if not exists tags text[] not null default '{}'::text[];
alter table public.posts add column if not exists comments jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists author_username text null;
alter table public.posts add column if not exists author_avatar_url text null;
alter table public.posts add column if not exists captured_at timestamptz null;
alter table public.posts add column if not exists region text null;
alter table public.posts add column if not exists detailed_location text null;
alter table public.posts add column if not exists place_name text null;
alter table public.posts add column if not exists category text null;
alter table public.posts add column if not exists category_name text null;
alter table public.posts alter column user_id drop not null;
alter table public.posts add column if not exists is_in_app_camera boolean not null default false;
alter table public.posts add column if not exists exif_data jsonb null;

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_region_created_at_idx on public.posts (region, created_at desc);

alter table public.posts enable row level security;

-- ✅ 멀티기기 표시의 핵심: 다른 기기(anon/authenticated)에서도 "읽기"가 반드시 열려 있어야 함
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts
for select to anon, authenticated using (true);

drop policy if exists "posts_insert_all" on public.posts;
create policy "posts_insert_all" on public.posts
for insert to anon, authenticated with check (true);

drop policy if exists "posts_update_all" on public.posts;
create policy "posts_update_all" on public.posts
for update to anon, authenticated using (true) with check (true);

drop policy if exists "posts_delete_all" on public.posts;
create policy "posts_delete_all" on public.posts
for delete to anon, authenticated using (true);


-- ============================================================
-- 2) magazines — 404 방지
-- ============================================================
create table if not exists public.magazines (
  id text primary key,
  title text not null default '',
  subtitle text not null default '',
  sections jsonb not null default '[]'::jsonb,
  author text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists magazines_created_at_idx on public.magazines (created_at desc);

alter table public.magazines enable row level security;

drop policy if exists "magazines_select_all" on public.magazines;
create policy "magazines_select_all" on public.magazines
for select to anon, authenticated using (true);

drop policy if exists "magazines_insert_all" on public.magazines;
create policy "magazines_insert_all" on public.magazines
for insert to anon, authenticated with check (true);

drop policy if exists "magazines_update_all" on public.magazines;
create policy "magazines_update_all" on public.magazines
for update to anon, authenticated using (true) with check (true);

drop policy if exists "magazines_delete_all" on public.magazines;
create policy "magazines_delete_all" on public.magazines
for delete to anon, authenticated using (true);


-- ============================================================
-- 3) Storage 정책(선택) — 버킷: post-images
--    버킷 자체 생성은 대시보드에서 1회 필요할 수 있음.
-- ============================================================
drop policy if exists "allow_public_upload_post_images" on storage.objects;
create policy "allow_public_upload_post_images" on storage.objects
for insert to anon, authenticated with check (bucket_id = 'post-images');

drop policy if exists "allow_public_read_post_images" on storage.objects;
create policy "allow_public_read_post_images" on storage.objects
for select to anon, authenticated using (bucket_id = 'post-images');


-- ============================================================
-- 4) raffles + admin_users (관리자 래플 운영)
-- - raffles: 전체 공개 조회, 관리자만 생성/수정/삭제
-- - admin_users: 관리자 표(대시보드에서만 추가 권장), 본인 행만 조회 가능
--   ⚠️ admin_users RLS 정책에서 admin_users를 다시 조회하면 "infinite recursion"이 발생할 수 있어 금지
-- ============================================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
for select to authenticated
using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE 정책은 두지 않습니다(대시보드/service role로만 관리 권장).

create table if not exists public.raffles (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'scheduled',
  title text not null default '',
  image_url text not null default '',
  description text not null default '',
  duration_days integer not null default 7,
  days_left text null,
  category text null,
  status_message text null,
  badge text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.raffles enable row level security;

drop policy if exists "raffles_select_all" on public.raffles;
create policy "raffles_select_all" on public.raffles
for select to anon, authenticated
using (true);

drop policy if exists "raffles_insert_admin" on public.raffles;
create policy "raffles_insert_admin" on public.raffles
for insert to authenticated
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "raffles_update_admin" on public.raffles;
create policy "raffles_update_admin" on public.raffles
for update to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "raffles_delete_admin" on public.raffles;
create policy "raffles_delete_admin" on public.raffles
for delete to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));


-- ============================================================
-- 5) raffle_entries + raffle_winners (종료 시 자동 추첨)
-- - raffle_entries: 유저별 응모권(티켓) 수
-- - raffle_winners: 래플 종료 시 자동 추첨 결과(1=당첨, 2~11=예비)
-- 추첨 로직(가중치):
--   각 티켓에 random() 점수를 부여하고, 유저별 최소값(best)을 비교하여 순위를 매김
--   -> 티켓 수가 많을수록 1등(최소값) 확률이 수학적으로 정직하게 증가
-- 엣지:
--   참여자가 11명 미만이면 있는 만큼만 저장
-- ============================================================

create table if not exists public.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tickets integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint raffle_entries_tickets_positive check (tickets >= 1),
  constraint raffle_entries_unique unique (raffle_id, user_id)
);

create index if not exists raffle_entries_raffle_id_idx on public.raffle_entries(raffle_id);
create index if not exists raffle_entries_user_id_idx on public.raffle_entries(user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_raffle_entries_touch on public.raffle_entries;
create trigger trg_raffle_entries_touch
before update on public.raffle_entries
for each row
execute function public.touch_updated_at();

alter table public.raffle_entries enable row level security;

drop policy if exists raffle_entries_select_own on public.raffle_entries;
create policy raffle_entries_select_own
on public.raffle_entries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists raffle_entries_insert_own on public.raffle_entries;
create policy raffle_entries_insert_own
on public.raffle_entries
for insert
to authenticated
with check (
  auth.uid() = user_id
  and tickets >= 1
  and exists (select 1 from public.raffles r where r.id = raffle_id and r.kind = 'ongoing')
);

drop policy if exists raffle_entries_update_own on public.raffle_entries;
create policy raffle_entries_update_own
on public.raffle_entries
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.raffles r where r.id = raffle_id and r.kind = 'ongoing')
)
with check (
  auth.uid() = user_id
  and tickets >= 1
  and exists (select 1 from public.raffles r where r.id = raffle_id and r.kind = 'ongoing')
);

create table if not exists public.raffle_winners (
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  rank integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tickets integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (raffle_id, rank),
  constraint raffle_winners_rank_range check (rank >= 1 and rank <= 11),
  constraint raffle_winners_unique_user unique (raffle_id, user_id)
);

create index if not exists raffle_winners_raffle_id_idx on public.raffle_winners(raffle_id);
create index if not exists raffle_winners_user_id_idx on public.raffle_winners(user_id);

alter table public.raffle_winners enable row level security;

drop policy if exists raffle_winners_select_completed on public.raffle_winners;
create policy raffle_winners_select_completed
on public.raffle_winners
for select
to anon, authenticated
using (exists (select 1 from public.raffles r where r.id = raffle_id and r.kind = 'completed'));

create or replace function public.draw_raffle_winners(raffle uuid, max_people integer default 11, per_user_cap integer default 0)
returns table(rank integer, user_id uuid, tickets integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := per_user_cap;
begin
  return query
  with participants as (
    select
      e.user_id,
      greatest(1, least(
        case when cap is null or cap <= 0 then e.tickets else cap end,
        e.tickets
      )) as tickets
    from public.raffle_entries e
    where e.raffle_id = raffle
  ),
  expanded as (
    select
      p.user_id,
      p.tickets,
      random() as ticket_score
    from participants p
    join lateral generate_series(1, p.tickets) g(n) on true
  ),
  scored as (
    select
      e.user_id,
      max(e.tickets) as tickets,
      min(e.ticket_score) as best_score
    from expanded e
    group by e.user_id
  ),
  ordered as (
    select
      (row_number() over (order by s.best_score asc))::int as rank,
      s.user_id,
      s.tickets
    from scored s
    order by s.best_score asc
    limit greatest(1, least(max_people, 11))
  )
  select o.rank, o.user_id, o.tickets from ordered o;
end;
$$;

create or replace function public.draw_raffle_if_needed(raffle uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.raffle_winners w where w.raffle_id = raffle) then
    return;
  end if;

  insert into public.raffle_winners(raffle_id, rank, user_id, tickets)
  select raffle as raffle_id, d.rank, d.user_id, d.tickets
  from public.draw_raffle_winners(raffle, 11, 0) d;
end;
$$;

create or replace function public.trg_raffles_auto_draw()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.kind = 'completed' and (old.kind is distinct from new.kind) then
      perform public.draw_raffle_if_needed(new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_raffles_auto_draw on public.raffles;
create trigger trg_raffles_auto_draw
after update of kind on public.raffles
for each row
execute function public.trg_raffles_auto_draw();
