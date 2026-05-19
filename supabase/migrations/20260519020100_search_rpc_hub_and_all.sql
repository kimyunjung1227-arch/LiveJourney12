-- 검색 화면 RPC: 탐색 허브 + 통합 검색
-- 48h 룰 + posts.exif_data 다중 좌표/시간 경로

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
        'id', u.id,
        'name', coalesce(u.username, '익명'),
        'avatar_color', '#4DB8E8'
      ) as author,
      case when q.place_name is not null and q.place_name <> ''
        then json_build_object('id', q.place_name, 'name', q.place_name)
        else null
      end as place
    from questions q
    left join users u on u.id = q.user_id
    where q.created_at > now() - interval '7 days'
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
  )
  select json_build_object(
    'seasonal', coalesce((select json_agg(s) from seasonal_data s), '[]'::json),
    'questions', coalesce((select json_agg(q) from question_data q), '[]'::json),
    'cities', coalesce((select json_agg(c) from city_data c), '[]'::json),
    'categories', coalesce((select json_agg(c) from category_data c), '[]'::json)
  );
$$;

grant execute on function public.get_search_hub() to anon, authenticated;

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
        'id', u.id,
        'name', coalesce(u.username, '익명'),
        'avatar_color', '#4DB8E8'
      ) as author,
      case when q.place_name is not null and q.place_name <> ''
        then json_build_object('id', q.place_name, 'name', q.place_name)
        else null
      end as place
    from questions q
    left join users u on u.id = q.user_id
    where q.body ilike '%' || p_query || '%'
       or q.place_name ilike '%' || p_query || '%'
    order by q.created_at desc
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
    'questions', coalesce((select json_agg(q) from question_rows q), '[]'::json)
  );
$$;

grant execute on function public.search_all(text) to anon, authenticated;
