-- 시즌 캘린더 + 질문하기 + 질문 전체보기 전면 개편
-- spec: 검색 허브 진입 → 시즌 캘린더(peak/soon/upcoming) / 질문 전체보기(my_region/other_region) / 질문 작성

-- 1) places: 카카오 장소 통합용 컬럼
alter table public.places add column if not exists kakao_id text;
alter table public.places add column if not exists lat double precision;
alter table public.places add column if not exists lng double precision;
create unique index if not exists places_kakao_id_unique on public.places(kakao_id) where kakao_id is not null;

-- 2) notifications: question_matched 추가
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'best_cut','milestone','best_answer','question_answered','question_matched',
    'like','comment','save','follow','post','badge','system'
  ])
);

-- 3) RPC: get_season_calendar (peak/soon/upcoming)
create or replace function public.get_season_calendar()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  with live_posts as (
    select p.id, p.place_id
    from posts p
    where p.is_live = true
      and coalesce(
        (p.exif_data->'tags'->>'DateTimeOriginal')::timestamptz,
        (p.exif_data->>'photoDate')::timestamptz,
        p.exif_taken_at,
        p.captured_at,
        p.created_at
      ) > now() - interval '48 hours'
  ),
  season_rows as (
    select
      sh.id, sh.title, sh.period_label, sh.peak_label,
      sh.cover_color_start, sh.cover_color_end,
      sh.starts_at, sh.ends_at, sh.peak_ends_at,
      sh.related_place_ids, sh.related_place_names,
      (
        select count(*)::int
        from live_posts lp
        where lp.place_id = any(coalesce(sh.related_place_ids, array[]::uuid[]))
      ) as live_count,
      coalesce(
        (select name from places where id = (sh.related_place_ids)[1]),
        (sh.related_place_names)[1],
        ''
      ) as primary_place,
      case
        when sh.starts_at <= current_date and coalesce(sh.peak_ends_at, sh.ends_at) >= current_date then 'peak'
        when sh.starts_at > current_date and sh.starts_at <= current_date + interval '14 days' then 'soon'
        when sh.starts_at > current_date + interval '14 days' then 'upcoming'
        else null
      end as bucket,
      case when sh.starts_at > current_date then (sh.starts_at - current_date)::int else null end as d_day
    from seasonal_highlights sh
    where sh.is_active = true
  )
  select json_build_object(
    'peak', coalesce(
      (select json_agg(row_to_json(s) order by s.starts_at) from season_rows s where s.bucket = 'peak'),
      '[]'::json
    ),
    'soon', coalesce(
      (select json_agg(row_to_json(s) order by s.starts_at) from season_rows s where s.bucket = 'soon'),
      '[]'::json
    ),
    'upcoming', coalesce(
      (select json_agg(row_to_json(s) order by s.starts_at) from season_rows s where s.bucket = 'upcoming'),
      '[]'::json
    )
  ) into result;
  return result;
end;
$$;

grant execute on function public.get_season_calendar() to anon, authenticated;

-- 4) RPC: get_questions_list (내 지역 우선)
create or replace function public.get_questions_list(
  p_category text default null,
  p_limit int default 30
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  v_my_city text;
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is not null then
    select pl.city into v_my_city
    from posts p
    join places pl on pl.id = p.place_id
    where p.user_id = v_uid
    group by pl.city
    order by count(*) desc
    limit 1;
  end if;

  with base as (
    select
      qu.id, qu.body, qu.created_at, qu.answer_count, qu.is_answered, qu.category,
      json_build_object(
        'id', u.id,
        'name', coalesce(u.username, '익명'),
        'avatar_color', '#4DB8E8'
      ) as author,
      coalesce(pl.name, qu.place_name, '') as place_name,
      coalesce(pl.city, '') as place_city
    from questions qu
    left join users u on u.id = qu.user_id
    left join places pl on pl.id = qu.place_id
    where p_category is null or qu.category = p_category
    order by qu.created_at desc
    limit p_limit
  )
  select json_build_object(
    'my_city', v_my_city,
    'my_region', coalesce(
      (select json_agg(json_build_object(
        'id', id, 'body', body, 'created_at', created_at,
        'answer_count', answer_count, 'is_answered', is_answered,
        'category', category, 'author', author, 'place_name', place_name
      ) order by created_at desc)
       from base where v_my_city is not null and place_city = v_my_city),
      '[]'::json
    ),
    'other_region', coalesce(
      (select json_agg(json_build_object(
        'id', id, 'body', body, 'created_at', created_at,
        'answer_count', answer_count, 'is_answered', is_answered,
        'category', category, 'author', author, 'place_name', place_name
      ) order by created_at desc)
       from base where v_my_city is null or place_city <> v_my_city),
      '[]'::json
    )
  ) into result;
  return result;
end;
$$;

grant execute on function public.get_questions_list(text, int) to anon, authenticated;

-- 5) RPC: find_or_create_place (카카오 → places)
create or replace function public.find_or_create_place(
  p_kakao_id text,
  p_name text,
  p_city text,
  p_district text,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id uuid;
begin
  if p_kakao_id is not null and p_kakao_id <> '' then
    select id into v_place_id from places where kakao_id = p_kakao_id;
  end if;

  if v_place_id is null then
    insert into places (kakao_id, name, city, district, lat, lng)
    values (nullif(p_kakao_id, ''), p_name, p_city, p_district, p_lat, p_lng)
    returning id into v_place_id;
  end if;

  return v_place_id;
end;
$$;

grant execute on function public.find_or_create_place(text, text, text, text, double precision, double precision) to authenticated;

-- 6) RPC: create_question (자동 매칭 알림 포함)
create or replace function public.create_question(
  p_body text,
  p_place_id uuid,
  p_category text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_city text;
  v_place_name text;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'auth required';
  end if;

  select city, name into v_city, v_place_name from places where id = p_place_id;

  insert into questions (user_id, body, place_id, place_name, category)
  values (v_uid, p_body, p_place_id, v_place_name, p_category)
  returning id into v_question_id;

  -- 같은 도시 + 최근 7일 활동자에게 매칭 알림 (자기 자신 제외)
  if v_city is not null then
    insert into notifications (user_id, recipient_id, recipient_user_id, type, question_id, actor_user_id)
    select distinct p.user_id, p.user_id, p.user_id, 'question_matched', v_question_id, v_uid
    from posts p
    join places pl on pl.id = p.place_id
    where pl.city = v_city
      and p.user_id <> v_uid
      and coalesce(p.exif_taken_at, p.created_at) > now() - interval '7 days'
      and (p_category is null or p.category = p_category);
  end if;

  return json_build_object('question_id', v_question_id);
end;
$$;

grant execute on function public.create_question(text, uuid, text) to authenticated;
