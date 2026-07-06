-- 검색 화면 강화:
--  (1) 탐색 허브(get_search_hub)에 "인기 여행자" 목록 추가 — 여행자들의 자부심을 위한 랭킹
--  (2) 통합 검색(search_all)에 "사용자(여행자)" 검색 결과 추가
--
-- 랭킹 철학: 팔로워(인기) 를 중심으로, 실시간 활동(48h 라이브)·도움 준 수·보유 뱃지를
--            가산해 "지금 활발하고 신뢰받는 여행자" 가 상위에 오르도록 한다.
--            프로필은 48h 노출 룰의 예외이므로 여행자 자체는 시간창으로 걸러내지 않고,
--            활동 이력(게시물 1개 이상)이 있는 여행자만 후보로 삼는다.
-- 기존 함수 본문은 그대로 유지하고, 여행자 관련 CTE/출력 키만 추가한다.

-- ────────────────────────────────────────────────
-- 1) get_search_hub — 인기 여행자(travelers) 추가
-- ────────────────────────────────────────────────
create or replace function public.get_search_hub()
returns json
language sql
security definer
set search_path = public
as $$
  with live as (
    select
      p.*,
      coalesce(
        (p.exif_data->'tags'->>'DateTimeOriginal')::timestamptz,
        (p.exif_data->>'photoDate')::timestamptz,
        p.captured_at,
        p.created_at
      ) as photo_at
    from posts p
    where p.exif_data is not null
  ),
  live_active as (
    select * from live where photo_at > now() - interval '48 hours'
  ),
  seasonal_data as (
    select
      sh.id,
      sh.title,
      sh.period_label,
      sh.cover_color_start,
      sh.cover_color_end,
      sh.starts_at,
      sh.ends_at,
      coalesce((
        select count(*)::int from live_active la
        where la.place_name = any(sh.related_place_names)
      ), 0) as live_count,
      (sh.starts_at <= current_date and sh.ends_at >= current_date) as is_active,
      (sh.starts_at > current_date) as is_upcoming
    from seasonal_highlights sh
    where sh.is_active = true
      and (sh.ends_at is null or sh.ends_at >= current_date)
    order by sh.display_order
    limit 10
  ),
  question_data as (
    select
      q.id,
      q.body,
      q.created_at,
      coalesce(q.answer_count, 0) as answer_count,
      coalesce(q.is_answered, false) as is_answered,
      json_build_object(
        'id', q.user_id,
        'name', coalesce(nullif(pr.username, ''), nullif(u.username, ''), '익명'),
        'avatar_url', nullif(pr.avatar_url, ''),
        'avatar_color', '#4DB8E8'
      ) as author,
      case when q.place_name is not null and q.place_name <> ''
        then json_build_object('id', q.place_name, 'name', q.place_name)
        else null
      end as place
    from questions q
    left join users u on u.id = q.user_id
    left join profiles pr on pr.id = q.user_id
    where q.created_at > now() - interval '48 hours'
    order by q.created_at desc
    limit 5
  ),
  city_data as (
    select region as city, count(*)::int as live_count
    from live_active
    where region is not null and region <> ''
    group by region
    order by live_count desc
    limit 4
  ),
  category_data as (
    select category, count(*)::int as live_count
    from live_active
    where category is not null
    group by category
  ),
  -- 팔로워/게시물/실시간 라이브 수를 여행자 단위로 1회 집계
  follow_counts as (
    select following_id as uid, count(*)::int as follower_count
    from follows
    group by following_id
  ),
  post_stats as (
    select
      p.user_id as uid,
      count(*)::int as post_count,
      count(*) filter (
        where coalesce(p.exif_taken_at, p.captured_at, p.created_at) > now() - interval '48 hours'
      )::int as live_count
    from posts p
    where p.user_id is not null
    group by p.user_id
  ),
  traveler_data as (
    select
      pr.id,
      coalesce(nullif(pr.username, ''), nullif(u.username, ''), '여행자') as name,
      nullif(pr.avatar_url, '') as avatar_url,
      coalesce(fc.follower_count, 0) as follower_count,
      coalesce(ps.live_count, 0) as live_count,
      coalesce(array_length(pr.earned_badges, 1), 0) as badge_count
    from profiles pr
    join post_stats ps on ps.uid = pr.id          -- 활동 이력이 있는 여행자만
    left join users u on u.id = pr.id
    left join follow_counts fc on fc.uid = pr.id
    where ps.post_count > 0
    order by
      (coalesce(fc.follower_count, 0) * 5
        + coalesce(ps.live_count, 0) * 3
        + coalesce(array_length(pr.earned_badges, 1), 0) * 3) desc,
      coalesce(fc.follower_count, 0) desc,
      ps.post_count desc
    limit 8
  )
  select json_build_object(
    'seasonal', coalesce((select json_agg(s) from seasonal_data s), '[]'::json),
    'questions', coalesce((select json_agg(q) from question_data q), '[]'::json),
    'cities', coalesce((select json_agg(c) from city_data c), '[]'::json),
    'categories', coalesce((select json_agg(c) from category_data c), '[]'::json),
    'travelers', coalesce((select json_agg(t) from traveler_data t), '[]'::json)
  );
$$;

grant execute on function public.get_search_hub() to anon, authenticated;

-- ────────────────────────────────────────────────
-- 2) search_all — 사용자(여행자) 검색 결과(users) 추가
-- ────────────────────────────────────────────────
create or replace function public.search_all(p_query text)
returns json
language sql
security definer
set search_path = public
as $$
  with live as (
    select
      p.*,
      coalesce(
        (p.exif_data->'tags'->>'DateTimeOriginal')::timestamptz,
        (p.exif_data->>'photoDate')::timestamptz,
        p.captured_at,
        p.created_at
      ) as photo_at,
      (p.images->>0)::text as thumb_url
    from posts p
    where p.exif_data is not null
  ),
  live_active as (
    select * from live where photo_at > now() - interval '48 hours'
  ),
  place_groups as (
    select
      place_name,
      max(region) as region,
      count(*)::int as live_count,
      (array_agg(thumb_url order by photo_at desc))[1] as thumb_url
    from live_active
    where place_name is not null and place_name <> ''
      and (place_name ilike '%' || p_query || '%' or region ilike '%' || p_query || '%')
    group by place_name
    order by live_count desc
    limit 10
  ),
  photo_rows as (
    select id, thumb_url, photo_at, content
    from live_active
    where (content ilike '%' || p_query || '%'
        or place_name ilike '%' || p_query || '%'
        or region ilike '%' || p_query || '%')
    order by photo_at desc
    limit 30
  ),
  photo_total as (
    select count(*)::int as n
    from live_active
    where (content ilike '%' || p_query || '%'
        or place_name ilike '%' || p_query || '%'
        or region ilike '%' || p_query || '%')
  ),
  question_rows as (
    select
      q.id,
      q.body,
      q.created_at,
      coalesce(q.answer_count, 0) as answer_count,
      coalesce(q.is_answered, false) as is_answered,
      json_build_object(
        'id', q.user_id,
        'name', coalesce(nullif(pr.username, ''), nullif(u.username, ''), '익명'),
        'avatar_url', nullif(pr.avatar_url, ''),
        'avatar_color', '#4DB8E8'
      ) as author,
      case when q.place_name is not null and q.place_name <> ''
        then json_build_object('id', q.place_name, 'name', q.place_name)
        else null
      end as place
    from questions q
    left join users u on u.id = q.user_id
    left join profiles pr on pr.id = q.user_id
    where (q.body ilike '%' || p_query || '%'
        or q.place_name ilike '%' || p_query || '%')
      and q.created_at > now() - interval '48 hours'
    order by q.created_at desc
    limit 10
  ),
  -- 여행자(사용자) 검색: 프로필 이름으로 매칭. 팔로워 많은 순.
  user_rows as (
    select
      pr.id,
      coalesce(nullif(pr.username, ''), nullif(u.username, ''), '여행자') as name,
      nullif(pr.avatar_url, '') as avatar_url,
      coalesce((select count(*) from follows f where f.following_id = pr.id), 0)::int as follower_count,
      coalesce((select count(*) from posts p2 where p2.user_id = pr.id), 0)::int as post_count
    from profiles pr
    left join users u on u.id = pr.id
    where pr.username ilike '%' || p_query || '%'
       or u.username ilike '%' || p_query || '%'
    order by follower_count desc, post_count desc
    limit 10
  )
  select json_build_object(
    'places', coalesce((
      select json_agg(json_build_object(
        'id', place_name,
        'name', place_name,
        'city', region,
        'district', null,
        'live_count', live_count,
        'thumbnail_url', thumb_url
      )) from place_groups
    ), '[]'::json),
    'photos', coalesce((
      select json_agg(json_build_object(
        'post_id', id,
        'thumbnail_url', thumb_url,
        'exif_taken_at', photo_at,
        'body', content
      )) from photo_rows
    ), '[]'::json),
    'photos_total', (select n from photo_total),
    'questions', coalesce((select json_agg(q) from question_rows q), '[]'::json),
    'users', coalesce((
      select json_agg(json_build_object(
        'id', id,
        'name', name,
        'avatar_url', avatar_url,
        'follower_count', follower_count,
        'post_count', post_count
      )) from user_rows
    ), '[]'::json)
  );
$$;

grant execute on function public.search_all(text) to anon, authenticated;
