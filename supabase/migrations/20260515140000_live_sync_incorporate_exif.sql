-- 라이브 싱크(%)에 EXIF 메타데이터를 명시 반영
-- - captured_at이 비어 있어도 exif_data->>'photoDate'로 촬영 시각을 삼아 업로드 간격(실시간성) 계산
-- - 촬영 시각·원시 DateTime·GPS·앱 내 카메라 등 EXIF 보유 비율에 별도 가산(max 12pt)
-- - 기존 트리거(lj_posts_live_sync_after_change 등)는 그대로 compute_live_sync_pct를 호출

do $$
begin
  if to_regclass('public.posts') is not null then
    alter table public.posts add column if not exists exif_data jsonb;
    alter table public.posts add column if not exists is_in_app_camera boolean not null default false;
  end if;
end $$;

-- JSON의 photoDate(ISO 문자열)를 안전하게 timestamptz로
create or replace function public.safe_exif_photo_date(p_exif jsonb)
returns timestamptz
language plpgsql
immutable
as $$
declare
  raw text;
begin
  if p_exif is null or jsonb_typeof(p_exif) <> 'object' then
    return null;
  end if;
  raw := nullif(trim(p_exif->>'photoDate'), '');
  if raw is null then
    return null;
  end if;
  begin
    return raw::timestamptz;
  exception
    when invalid_datetime_format then
      return null;
    when others then
      return null;
  end;
end;
$$;

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
  max_up_exif numeric := 12;
  max_down_old_photo numeric := 20;
  realtime_window_min numeric := 10;
  old_photo_threshold_hours numeric := 24;
  inactivity_half_life_days numeric := 14;

  last_active timestamptz;
  realtime_ratio_avg numeric := 0;
  helpful_total integer := 0;
  qna_count integer := 0;
  max_gap_hours numeric := 0;
  exif_ratio numeric := 0;

  realtime_score numeric := 0;
  helpful_score numeric := 0;
  qna_score numeric := 0;
  exif_score numeric := 0;
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

  -- 1) 실시간 인증: coalesce(captured_at, EXIF photoDate) vs created_at
  select coalesce(
    avg(
      greatest(
        0,
        1 - (
          (abs(extract(epoch from (
            p.created_at - coalesce(p.captured_at, public.safe_exif_photo_date(p.exif_data))
          ))) / 60)
          / realtime_window_min
        )
      )
    ),
    0
  )
  into realtime_ratio_avg
  from public.posts p
  where p.user_id = p_user_id
    and coalesce(p.captured_at, public.safe_exif_photo_date(p.exif_data)) is not null;

  realtime_score := max_up_realtime * greatest(0, least(1, realtime_ratio_avg));

  -- 2) 도움돼요(좋아요)
  select coalesce(sum(p.likes_count), 0)::int
  into helpful_total
  from public.posts p
  where p.user_id = p_user_id;

  helpful_score := max_up_helpful * sqrt(greatest(0, least(1, (helpful_total::numeric / 200))));

  -- 3) Q&A 채택
  if to_regclass('public.help_answer_accepts') is not null then
    select count(*)::int
    into qna_count
    from public.help_answer_accepts h
    where h.accepted_user_id = p_user_id;
  else
    qna_count := 0;
  end if;

  qna_score := max_up_qna * greatest(0, least(1, (qna_count::numeric / 5)));

  -- 3b) EXIF 보유 비율: 촬영일·원시 DateTime·GPS·앱 내 카메라 중 하나라도 있으면 "EXIF 태그 제보"로 집계
  select case
    when count(*) = 0 then 0::numeric
    else (
      count(*) filter (
        where p.exif_data is not null and (
          public.safe_exif_photo_date(p.exif_data) is not null
          or nullif(trim(p.exif_data->>'dateTimeOriginalRaw'), '') is not null
          or (
            p.exif_data ? 'gpsCoordinates'
            and nullif(trim(p.exif_data #>> '{gpsCoordinates,lat}'), '') is not null
            and nullif(trim(p.exif_data #>> '{gpsCoordinates,lng}'), '') is not null
          )
          or coalesce(p.is_in_app_camera, false) is true
        )
      )
    )::numeric / nullif(count(*), 0)
  end
  into exif_ratio
  from public.posts p
  where p.user_id = p_user_id;

  exif_score := max_up_exif * sqrt(greatest(0, least(1, exif_ratio)));

  -- 4) 과거 사진 페널티 (동일하게 coalesce 촬영 시각 사용)
  select coalesce(
    max(
      abs(extract(epoch from (
        p.created_at - coalesce(p.captured_at, public.safe_exif_photo_date(p.exif_data))
      ))) / (60 * 60)
    ),
    0
  )
  into max_gap_hours
  from public.posts p
  where p.user_id = p_user_id
    and coalesce(p.captured_at, public.safe_exif_photo_date(p.exif_data)) is not null;

  if max_gap_hours > old_photo_threshold_hours then
    old_penalty := max_down_old_photo * greatest(
      0,
      least(1, ((max_gap_hours - old_photo_threshold_hours) / (24 * 6)))
    );
  else
    old_penalty := 0;
  end if;

  sync_raw := base + realtime_score + helpful_score + qna_score + exif_score - old_penalty;
  sync_raw := greatest(0, least(100, sync_raw));

  days_inactive := (extract(epoch from (now() - last_active)) / (60 * 60 * 24));
  if days_inactive > 0.5 then
    factor := power(0.5, (days_inactive / greatest(1, inactivity_half_life_days)));
    sync_raw := base + (sync_raw - base) * factor;
  end if;

  return round(sync_raw)::int;
end;
$$;

-- EXIF 반영 후 기존 작성자 전원 재계산
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
