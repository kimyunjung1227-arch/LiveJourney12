-- LiveJourney: profiles.live_sync_pct (server computed) + activity triggers
-- - 목적: 게시물/좋아요/Q&A 채택 등 활동에 따라 라이브 싱크(%)가 자동으로 갱신되도록 함
-- - 클라이언트는 profiles.live_sync_pct를 Realtime로 구독하면 즉시 반영 가능

do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'public.profiles not found; skipping live_sync_pct setup.';
    return;
  end if;

  alter table public.profiles
    add column if not exists live_sync_pct integer not null default 35;

  alter table public.profiles
    add column if not exists live_sync_updated_at timestamptz null;
end $$;

-- Compute live sync percent for a user (0~100, int)
create or replace function public.compute_live_sync_pct(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  base numeric := 35;
  max_up_realtime numeric := 25;
  max_up_helpful numeric := 15;
  max_up_qna numeric := 10;
  max_down_old_photo numeric := 20;
  realtime_window_min numeric := 10;
  old_photo_threshold_hours numeric := 24;
  inactivity_half_life_days numeric := 14;

  last_active timestamptz;
  realtime_ratio_avg numeric := 0;
  helpful_total integer := 0;
  qna_count integer := 0;
  max_gap_hours numeric := 0;

  realtime_score numeric := 0;
  helpful_score numeric := 0;
  qna_score numeric := 0;
  old_penalty numeric := 0;
  sync_raw numeric := 0;

  days_inactive numeric := 0;
  factor numeric := 1;
begin
  if p_user_id is null then
    return base::int;
  end if;

  if to_regclass('public.posts') is null then
    return base::int;
  end if;

  select max(p.created_at)
  into last_active
  from public.posts p
  where p.user_id = p_user_id;

  if last_active is null then
    return base::int;
  end if;

  -- 1) 실시간 인증: 촬영시간(captured_at)과 업로드(created_at) 시차가 짧을수록 상승
  select coalesce(
    avg(
      greatest(
        0,
        1 - (
          (abs(extract(epoch from (p.created_at - p.captured_at))) / 60)
          / realtime_window_min
        )
      )
    ),
    0
  )
  into realtime_ratio_avg
  from public.posts p
  where p.user_id = p_user_id
    and p.captured_at is not null;

  realtime_score := max_up_realtime * greatest(0, least(1, realtime_ratio_avg));

  -- 2) 도움돼요(좋아요): 내 게시물 likes_count 누적
  select coalesce(sum(p.likes_count), 0)::int
  into helpful_total
  from public.posts p
  where p.user_id = p_user_id;

  helpful_score := max_up_helpful * sqrt(greatest(0, least(1, (helpful_total::numeric / 200))));

  -- 3) Q&A 채택: help_answer_accepts(accepted_user_id) 누적
  if to_regclass('public.help_answer_accepts') is not null then
    select count(*)::int
    into qna_count
    from public.help_answer_accepts h
    where h.accepted_user_id = p_user_id;
  else
    qna_count := 0;
  end if;

  qna_score := max_up_qna * greatest(0, least(1, (qna_count::numeric / 5)));

  -- 4) 과거 사진 페널티: captured_at이 너무 과거면 감점
  select coalesce(
    max(abs(extract(epoch from (p.created_at - p.captured_at))) / (60 * 60)),
    0
  )
  into max_gap_hours
  from public.posts p
  where p.user_id = p_user_id
    and p.captured_at is not null;

  if max_gap_hours > old_photo_threshold_hours then
    old_penalty := max_down_old_photo * greatest(
      0,
      least(1, ((max_gap_hours - old_photo_threshold_hours) / (24 * 6)))
    );
  else
    old_penalty := 0;
  end if;

  sync_raw := base + realtime_score + helpful_score + qna_score - old_penalty;
  sync_raw := greatest(0, least(100, sync_raw));

  -- 5) 미활동 수렴: 시간이 지날수록 base(35%)로 완만하게 회귀
  days_inactive := (extract(epoch from (now() - last_active)) / (60 * 60 * 24));
  if days_inactive > 0.5 then
    factor := power(0.5, (days_inactive / greatest(1, inactivity_half_life_days)));
    sync_raw := base + (sync_raw - base) * factor;
  end if;

  return round(sync_raw)::int;
end;
$$;

create or replace function public.update_profile_live_sync_pct(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_pct integer;
begin
  if p_user_id is null then
    return;
  end if;
  if to_regclass('public.profiles') is null then
    return;
  end if;

  v_pct := public.compute_live_sync_pct(p_user_id);

  update public.profiles
  set live_sync_pct = v_pct,
      live_sync_updated_at = now()
  where id = p_user_id;
end;
$$;

-- Trigger: posts changes -> update author live sync
create or replace function public.tg_posts_update_author_live_sync()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user uuid;
begin
  v_user := coalesce(new.user_id, old.user_id);
  if v_user is not null then
    perform public.update_profile_live_sync_pct(v_user);
  end if;
  return null;
end;
$$;

do $$
begin
  if to_regclass('public.posts') is not null then
    drop trigger if exists lj_posts_live_sync_after_change on public.posts;
    create trigger lj_posts_live_sync_after_change
      after insert or update or delete on public.posts
      for each row execute function public.tg_posts_update_author_live_sync();
  end if;
end $$;

-- Trigger: post_likes changes -> update post author live sync (likes_count is maintained elsewhere)
create or replace function public.tg_post_likes_update_post_author_live_sync()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_post_id uuid;
  v_author uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  if v_post_id is null then
    return null;
  end if;
  if to_regclass('public.posts') is null then
    return null;
  end if;
  select p.user_id into v_author from public.posts p where p.id = v_post_id;
  if v_author is not null then
    perform public.update_profile_live_sync_pct(v_author);
  end if;
  return null;
end;
$$;

do $$
begin
  if to_regclass('public.post_likes') is not null then
    drop trigger if exists lj_post_likes_live_sync_after_change on public.post_likes;
    create trigger lj_post_likes_live_sync_after_change
      after insert or delete on public.post_likes
      for each row execute function public.tg_post_likes_update_post_author_live_sync();
  end if;
end $$;

-- Trigger: Q&A 채택 -> accepted_user_id 점수 갱신
create or replace function public.tg_help_answer_accepts_update_live_sync()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.accepted_user_id is not null then
    perform public.update_profile_live_sync_pct(new.accepted_user_id);
  end if;
  return null;
end;
$$;

do $$
begin
  if to_regclass('public.help_answer_accepts') is not null then
    drop trigger if exists lj_help_answer_accepts_live_sync_after_insert on public.help_answer_accepts;
    create trigger lj_help_answer_accepts_live_sync_after_insert
      after insert on public.help_answer_accepts
      for each row execute function public.tg_help_answer_accepts_update_live_sync();
  end if;
end $$;

-- Best-effort backfill for existing profiles (only for users who already have posts)
do $$
begin
  if to_regclass('public.posts') is null or to_regclass('public.profiles') is null then
    return;
  end if;
  update public.profiles pr
  set live_sync_pct = public.compute_live_sync_pct(pr.id),
      live_sync_updated_at = now()
  where exists (select 1 from public.posts p where p.user_id = pr.id);
end $$;

