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
-- ⚠️ raffle_entries는 클라이언트가 직접 tickets를 조작할 수 있으므로
-- INSERT/UPDATE 정책을 두지 않습니다. 응모는 RPC(public.enter_raffle)로만 처리합니다.

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

-- ============================================================
-- 6) 응모권(티켓) 2트랙 + 재충전(쿨타임)
-- - 활동(휘발): 실시간 도움(Q&A) 답변이 채택되면 1표 적립, 응모 시 즉시 소모
-- - 뱃지(자산): 보유 뱃지의 raffle_ticket_value 합산, 당첨 전까지 무제한 재사용
-- - 당첨 시(1등): 뱃지 응모권을 다음 3회 래플 참여 동안 0표로 비활성화(쿨타임)
--   * 활동 복구: 채택 답변 5회 달성 시 즉시 부활
-- ============================================================

alter table public.badges
  add column if not exists raffle_ticket_value integer not null default 0;

-- 기존 dyn:* 뱃지는 tier 기반으로 1/5/10 자동 부여(장르별 활동 등급용)
update public.badges
set raffle_ticket_value = case
  when code like 'dyn:%:tier1' then 1
  when code like 'dyn:%:tier2' then 5
  when code like 'dyn:%:tier3' then 10
  else raffle_ticket_value
end
where raffle_ticket_value = 0;

create table if not exists public.raffle_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  badge_cooldown_raffles_remaining integer not null default 0,
  recharge_help_accepted_count integer not null default 0,
  last_win_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint raffle_user_state_nonneg check (badge_cooldown_raffles_remaining >= 0 and recharge_help_accepted_count >= 0)
);

alter table public.raffle_user_state enable row level security;

drop policy if exists raffle_user_state_select_own on public.raffle_user_state;
create policy raffle_user_state_select_own
on public.raffle_user_state
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.raffle_activity_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint raffle_activity_balances_nonneg check (balance >= 0)
);

alter table public.raffle_activity_balances enable row level security;

drop policy if exists raffle_activity_balances_select_own on public.raffle_activity_balances;
create policy raffle_activity_balances_select_own
on public.raffle_activity_balances
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_updated_at_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_raffle_user_state_touch on public.raffle_user_state;
create trigger trg_raffle_user_state_touch
before update on public.raffle_user_state
for each row
execute function public.touch_updated_at_row();

drop trigger if exists trg_raffle_activity_balances_touch on public.raffle_activity_balances;
create trigger trg_raffle_activity_balances_touch
before update on public.raffle_activity_balances
for each row
execute function public.touch_updated_at_row();

-- Q&A 답변 채택 기록(중복 채택 방지 + 활동표 지급 트리거용)
create table if not exists public.help_answer_accepts (
  post_id uuid not null references public.posts(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  accepted_by uuid not null references auth.users(id) on delete cascade,
  accepted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, comment_id),
  constraint help_answer_accepts_one_per_post unique (post_id)
);

alter table public.help_answer_accepts enable row level security;

drop policy if exists help_answer_accepts_select_owner on public.help_answer_accepts;
create policy help_answer_accepts_select_owner
on public.help_answer_accepts
for select
to authenticated
using (
  exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
);

drop policy if exists help_answer_accepts_select_accepted_user on public.help_answer_accepts;
create policy help_answer_accepts_select_accepted_user
on public.help_answer_accepts
for select
to authenticated
using (accepted_user_id = auth.uid());

-- 내 응모권 현황(뱃지/활동/쿨타임) 조회용
create or replace function public.get_my_raffle_ticket_status(raffle uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  badge_total int := 0;
  badge_active int := 0;
  activity_balance int := 0;
  cooldown int := 0;
  recharge int := 0;
  raffle_kind text := null;
begin
  if uid is null then
    raise exception 'auth required';
  end if;

  select r.kind into raffle_kind from public.raffles r where r.id = raffle;
  if raffle_kind is null then
    raise exception 'raffle not found';
  end if;

  select coalesce(sum(greatest(0, b.raffle_ticket_value)), 0)::int
  into badge_total
  from public.user_badges ub
  join public.badges b on b.id = ub.badge_id
  where ub.user_id = uid;

  select s.badge_cooldown_raffles_remaining, s.recharge_help_accepted_count
    into cooldown, recharge
  from public.raffle_user_state s
  where s.user_id = uid;

  if cooldown is null then
    cooldown := 0;
    recharge := 0;
  end if;

  select a.balance into activity_balance
  from public.raffle_activity_balances a
  where a.user_id = uid;

  if activity_balance is null then
    activity_balance := 0;
  end if;

  badge_active := case when cooldown > 0 then 0 else badge_total end;

  return jsonb_build_object(
    'raffleId', raffle,
    'raffleKind', raffle_kind,
    'badgeTicketsTotal', badge_total,
    'badgeTicketsActive', badge_active,
    'activityTicketsBalance', activity_balance,
    'cooldownRafflesRemaining', cooldown,
    'rechargeHelpAcceptedCount', recharge,
    'rechargeTarget', 5,
    'totalEffectiveTickets', (badge_active + activity_balance)
  );
end;
$$;

-- 응모: 활동표는 소모 + 쿨타임이면 뱃지표 0으로 반영
create or replace function public.enter_raffle(raffle uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  badge_total int := 0;
  badge_active int := 0;
  activity_balance int := 0;
  total_tickets int := 0;
  cooldown int := 0;
  recharge int := 0;
  raffle_kind text := null;
begin
  if uid is null then
    raise exception 'auth required';
  end if;

  select r.kind into raffle_kind from public.raffles r where r.id = raffle;
  if raffle_kind is distinct from 'ongoing' then
    raise exception 'raffle not ongoing';
  end if;

  insert into public.raffle_user_state(user_id)
  values (uid)
  on conflict (user_id) do nothing;

  insert into public.raffle_activity_balances(user_id)
  values (uid)
  on conflict (user_id) do nothing;

  select s.badge_cooldown_raffles_remaining, s.recharge_help_accepted_count
    into cooldown, recharge
  from public.raffle_user_state s
  where s.user_id = uid;

  select a.balance into activity_balance
  from public.raffle_activity_balances a
  where a.user_id = uid;

  if activity_balance is null then activity_balance := 0; end if;

  select coalesce(sum(greatest(0, b.raffle_ticket_value)), 0)::int
  into badge_total
  from public.user_badges ub
  join public.badges b on b.id = ub.badge_id
  where ub.user_id = uid;

  badge_active := case when cooldown > 0 then 0 else badge_total end;
  total_tickets := badge_active + activity_balance;

  if total_tickets <= 0 then
    raise exception 'no tickets';
  end if;

  insert into public.raffle_entries(raffle_id, user_id, tickets)
  values (raffle, uid, total_tickets)
  on conflict (raffle_id, user_id)
  do update set tickets = excluded.tickets, updated_at = now();

  update public.raffle_activity_balances
    set balance = 0
  where user_id = uid;

  if cooldown > 0 then
    update public.raffle_user_state
      set badge_cooldown_raffles_remaining = greatest(0, badge_cooldown_raffles_remaining - 1)
    where user_id = uid;
    cooldown := greatest(0, cooldown - 1);
  end if;

  return jsonb_build_object(
    'success', true,
    'raffleId', raffle,
    'badgeTicketsTotal', badge_total,
    'badgeTicketsApplied', badge_active,
    'activityTicketsApplied', activity_balance,
    'totalTicketsApplied', total_tickets,
    'cooldownRafflesRemainingAfter', cooldown,
    'rechargeHelpAcceptedCount', recharge
  );
end;
$$;

-- Q&A: 글 작성자가 답변을 채택하면, 답변자에게 활동표 + 재충전 카운트를 적립
create or replace function public.accept_help_answer(post uuid, comment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  post_owner uuid;
  post_category text;
  answer_user uuid;
  cooldown int := 0;
  recharge int := 0;
  existing_comment uuid;
begin
  if uid is null then
    raise exception 'auth required';
  end if;

  select p.user_id, p.category into post_owner, post_category
  from public.posts p
  where p.id = post;

  if post_owner is null then
    raise exception 'post not found';
  end if;
  if post_owner <> uid then
    raise exception 'only post owner can accept';
  end if;
  if coalesce(post_category,'') <> 'question' then
    raise exception 'not a question post';
  end if;

  -- 이미 채택된 답변이 있으면 즉시 반환
  select h.comment_id into existing_comment
  from public.help_answer_accepts h
  where h.post_id = post;

  if existing_comment is not null then
    return jsonb_build_object('success', true, 'alreadyAccepted', true, 'commentId', existing_comment);
  end if;

  select c.user_id into answer_user
  from public.comments c
  where c.id = comment and c.post_id = post;

  if answer_user is null then
    raise exception 'comment not found';
  end if;

  insert into public.help_answer_accepts(post_id, comment_id, accepted_by, accepted_user_id)
  values (post, comment, uid, answer_user);

  insert into public.raffle_user_state(user_id)
  values (answer_user)
  on conflict (user_id) do nothing;

  insert into public.raffle_activity_balances(user_id)
  values (answer_user)
  on conflict (user_id) do nothing;

  update public.raffle_activity_balances
    set balance = balance + 1
  where user_id = answer_user;

  select s.badge_cooldown_raffles_remaining, s.recharge_help_accepted_count
    into cooldown, recharge
  from public.raffle_user_state s
  where s.user_id = answer_user;

  if cooldown > 0 then
    recharge := recharge + 1;
    if recharge >= 5 then
      update public.raffle_user_state
        set badge_cooldown_raffles_remaining = 0,
            recharge_help_accepted_count = 0
      where user_id = answer_user;
    else
      update public.raffle_user_state
        set recharge_help_accepted_count = recharge
      where user_id = answer_user;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'acceptedUserId', answer_user,
    'commentId', comment,
    'activityTicketGranted', 1,
    'cooldownRafflesRemaining', cooldown,
    'rechargeHelpAcceptedCount', case when cooldown > 0 then least(recharge, 5) else 0 end
  );
end;
$$;

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
declare
  win_user uuid;
begin
  if exists (select 1 from public.raffle_winners w where w.raffle_id = raffle) then
    return;
  end if;

  insert into public.raffle_winners(raffle_id, rank, user_id, tickets)
  select raffle as raffle_id, d.rank, d.user_id, d.tickets
  from public.draw_raffle_winners(raffle, 11, 0) d;

  -- 1등(당첨자)에게 뱃지 응모권 재충전(쿨타임) 적용
  select w.user_id into win_user
  from public.raffle_winners w
  where w.raffle_id = raffle and w.rank = 1;

  if win_user is not null then
    insert into public.raffle_user_state(user_id)
    values (win_user)
    on conflict (user_id) do nothing;

    update public.raffle_user_state
      set badge_cooldown_raffles_remaining = 3,
          recharge_help_accepted_count = 0,
          last_win_at = now()
    where user_id = win_user;
  end if;
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
