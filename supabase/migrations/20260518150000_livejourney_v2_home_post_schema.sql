-- Live Journey v2 (HomeScreen + PostDetailScreen) 신규 스키마
-- 기존 posts/post_comments와 분리해 lj_ 프리픽스로 격리한다.
-- 핵심 차별점: EXIF 시간 + 48시간 룰 + 댓글 트리(1단계 깊이) + 낙관적 반응.

set search_path = public;

-- 0. 카테고리 enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lj_category') then
    create type lj_category as enum (
      'nature',     -- 개화·자연
      'weather',    -- 날씨·체감
      'event',      -- 이벤트·축제
      'crowd',      -- 혼잡도·대기
      'sunset',     -- 노을·야경
      'business'    -- 영업·운영
    );
  end if;
end$$;

-- 1. 게시물
create table if not exists public.lj_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  category lj_category not null,
  place_id uuid,
  place_name text not null,
  body text not null default '',
  exif_taken_at timestamptz not null,
  expires_at timestamptz generated always as (exif_taken_at + interval '48 hours') stored,
  is_on_site boolean not null default true,
  helped_count integer not null default 0,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  save_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lj_posts_live_idx
  on public.lj_posts (created_at desc)
  where expires_at > now();

create index if not exists lj_posts_category_idx on public.lj_posts (category);
create index if not exists lj_posts_author_idx on public.lj_posts (author_id);

-- 2. 댓글 (트리: parent_id 1단계 깊이만 허용)
create table if not exists public.lj_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lj_posts(id) on delete cascade,
  parent_id uuid references public.lj_comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lj_comments_post_idx on public.lj_comments (post_id, created_at);

-- 답글의 답글 금지 (1단계 깊이만)
create or replace function public.lj_comments_enforce_depth()
returns trigger
language plpgsql
as $$
declare
  parent_parent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select parent_id into parent_parent
  from public.lj_comments
  where id = new.parent_id;
  if parent_parent is not null then
    -- 답글의 답글: 같은 최상위 부모로 평탄화
    new.parent_id := parent_parent;
  end if;
  return new;
end;
$$;

drop trigger if exists lj_comments_depth_trg on public.lj_comments;
create trigger lj_comments_depth_trg
  before insert on public.lj_comments
  for each row execute function public.lj_comments_enforce_depth();

-- 댓글 수 카운터
create or replace function public.lj_comments_bump_counter()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.lj_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.lj_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists lj_comments_count_trg on public.lj_comments;
create trigger lj_comments_count_trg
  after insert or delete on public.lj_comments
  for each row execute function public.lj_comments_bump_counter();

-- 3. 반응 (좋아요/저장)
create table if not exists public.lj_reactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.lj_posts(id) on delete cascade,
  kind text not null check (kind in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id, kind)
);

create index if not exists lj_reactions_post_idx on public.lj_reactions (post_id, kind);

-- 반응 수 카운터
create or replace function public.lj_reactions_bump_counter()
returns trigger
language plpgsql
as $$
declare
  delta integer;
  target_id uuid;
  target_kind text;
begin
  if tg_op = 'INSERT' then
    delta := 1; target_id := new.post_id; target_kind := new.kind;
  elsif tg_op = 'DELETE' then
    delta := -1; target_id := old.post_id; target_kind := old.kind;
  else
    return null;
  end if;

  if target_kind = 'like' then
    update public.lj_posts set like_count = greatest(0, like_count + delta) where id = target_id;
  elsif target_kind = 'save' then
    update public.lj_posts set save_count = greatest(0, save_count + delta) where id = target_id;
  end if;
  return null;
end;
$$;

drop trigger if exists lj_reactions_count_trg on public.lj_reactions;
create trigger lj_reactions_count_trg
  after insert or delete on public.lj_reactions
  for each row execute function public.lj_reactions_bump_counter();

-- 4. 라이브 카운트 뷰 (HomeScreen 헤더 "지금 N장 라이브")
create or replace view public.lj_live_count as
  select count(*)::integer as live_count
  from public.lj_posts
  where expires_at > now();

-- 5. RLS
alter table public.lj_posts enable row level security;
alter table public.lj_comments enable row level security;
alter table public.lj_reactions enable row level security;

-- 게시물: 누구나 읽기, 본인만 쓰기/수정/삭제
drop policy if exists lj_posts_read on public.lj_posts;
create policy lj_posts_read on public.lj_posts
  for select using (true);

drop policy if exists lj_posts_insert on public.lj_posts;
create policy lj_posts_insert on public.lj_posts
  for insert with check (auth.uid() = author_id);

drop policy if exists lj_posts_update on public.lj_posts;
create policy lj_posts_update on public.lj_posts
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists lj_posts_delete on public.lj_posts;
create policy lj_posts_delete on public.lj_posts
  for delete using (auth.uid() = author_id);

-- 댓글: 누구나 읽기, 로그인한 사람만 쓰기, 본인만 수정/삭제
drop policy if exists lj_comments_read on public.lj_comments;
create policy lj_comments_read on public.lj_comments
  for select using (true);

drop policy if exists lj_comments_insert on public.lj_comments;
create policy lj_comments_insert on public.lj_comments
  for insert with check (auth.uid() = author_id);

drop policy if exists lj_comments_update on public.lj_comments;
create policy lj_comments_update on public.lj_comments
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists lj_comments_delete on public.lj_comments;
create policy lj_comments_delete on public.lj_comments
  for delete using (auth.uid() = author_id);

-- 반응: 누구나 읽기, 본인만 토글
drop policy if exists lj_reactions_read on public.lj_reactions;
create policy lj_reactions_read on public.lj_reactions
  for select using (true);

drop policy if exists lj_reactions_insert on public.lj_reactions;
create policy lj_reactions_insert on public.lj_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists lj_reactions_delete on public.lj_reactions;
create policy lj_reactions_delete on public.lj_reactions
  for delete using (auth.uid() = user_id);

-- 6. 작성자 도움 카운트 합산용 RPC (프로필 helped_count 표시)
create or replace function public.lj_author_helped_count(p_author uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(like_count + save_count), 0)::integer
  from public.lj_posts
  where author_id = p_author;
$$;

grant select on public.lj_live_count to anon, authenticated;
grant execute on function public.lj_author_helped_count(uuid) to anon, authenticated;
