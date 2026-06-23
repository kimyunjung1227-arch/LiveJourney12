-- 질문도 48시간 노출 윈도우 적용 (실시간성 시스템과 통일).
-- 사진/핫플/검색과 마찬가지로, 작성 후 48시간이 지난 질문은 목록·검색·허브·지역
-- 노출 surface 에서 자동으로 빠진다. (기준: questions.created_at)
-- 질문 상세(get_question_detail)는 직접 접근(알림/링크)이므로 필터하지 않는다
--   — 게시물 상세가 48h 이후에도 id 로 열리는 것과 동일한 정책.
-- 영향 RPC: get_questions_list / get_search_hub / search_all / get_city_detail
-- 함수 본문은 기존과 동일, 질문 쿼리의 WHERE 절에 48h 조건만 추가/조정.

-- 1) 실시간 질문 목록 — base 에 48h 필터 추가
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
        'id', qu.user_id,
        'name', coalesce(nullif(pr.username, ''), nullif(u.username, ''), '익명'),
        'avatar_url', nullif(pr.avatar_url, ''),
        'avatar_color', '#4DB8E8'
      ) as author,
      coalesce(pl.name, qu.place_name, '') as place_name,
      coalesce(pl.city, '') as place_city
    from questions qu
    left join users u on u.id = qu.user_id
    left join profiles pr on pr.id = qu.user_id
    left join places pl on pl.id = qu.place_id
    where (p_category is null or qu.category = p_category)
      and qu.created_at > now() - interval '48 hours'
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

-- 2) 검색 허브의 실시간 질문 카드 — 7일 → 48시간으로 윈도우 통일
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
  )
  select json_build_object(
    'seasonal', coalesce((select json_agg(s) from seasonal_data s), '[]'::json),
    'questions', coalesce((select json_agg(q) from question_data q), '[]'::json),
    'cities', coalesce((select json_agg(c) from city_data c), '[]'::json),
    'categories', coalesce((select json_agg(c) from category_data c), '[]'::json)
  );
$$;

grant execute on function public.get_search_hub() to anon, authenticated;

-- 3) 통합 검색 결과의 질문 — 48h 필터 추가
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

-- 4) 지역 상세의 질문 — 48h 필터 추가
create or replace function public.get_city_detail(p_city text, p_category text default null::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  result json;
begin
  with live as (
    select
      p.*,
      coalesce(
        (p.exif_data->'tags'->>'DateTimeOriginal')::timestamptz,
        (p.exif_data->>'photoDate')::timestamptz,
        p.exif_taken_at,
        p.captured_at,
        p.created_at
      ) as photo_at,
      coalesce(pl.city, p.region) as city_resolved,
      pl.district as district_resolved,
      pl.id as place_id_resolved,
      pl.name as place_name_resolved,
      public.lj_category_id(coalesce(p.category_name, p.category)) as category_resolved
    from posts p
    left join places pl on pl.id = p.place_id
    where (
      p.is_live = true
      or p.exif_taken_at > now() - interval '48 hours'
      or p.exif_data is not null
    )
  ),
  city_live as (
    select * from live
    where (
        -- 정확 일치 + 양방향 부분일치 (상세 주소 ↔ 짧은 도시명 모두 매칭)
        city_resolved = p_city
        or city_resolved ilike '%' || p_city || '%'
        or p_city ilike '%' || city_resolved || '%'
      )
      and (photo_at > now() - interval '48 hours' or is_live = true)
      and (p_category is null or category_resolved = p_category)
  )
  select json_build_object(
    'city', json_build_object(
      'name', p_city,
      'live_count', (select count(*)::int from city_live)
    ),
    'photos', coalesce(
      (select json_agg(ph order by ph.exif_taken_at desc) from (
        select id as post_id, photo_url as thumbnail_url, photo_at as exif_taken_at
        from city_live
        where photo_url is not null
        order by photo_at desc
        limit 30
      ) ph),
      '[]'::json
    ),
    'photos_total', (select count(*)::int from city_live where photo_url is not null),
    'hot_places', coalesce(
      (select json_agg(hp order by hp.live_count desc) from (
        select
          pl.id,
          pl.name,
          pl.district,
          count(cl.id)::int as live_count,
          (select photo_url from city_live cl2
            where cl2.place_id_resolved = pl.id and cl2.photo_url is not null
            order by cl2.photo_at desc limit 1) as thumbnail_url,
          (count(cl.id) filter (where cl.photo_at > now() - interval '1 hour') >= 5) as is_hot
        from places pl
        join city_live cl on cl.place_id_resolved = pl.id
        group by pl.id
        order by live_count desc
        limit 5
      ) hp),
      '[]'::json
    ),
    'questions', coalesce(
      (select json_agg(q order by q.created_at desc) from (
        select
          qu.id,
          qu.body,
          qu.created_at,
          coalesce(qu.answer_count, 0) as answer_count,
          coalesce(qu.is_answered, false) as is_answered,
          json_build_object(
            'id', u.id,
            'name', coalesce(
              nullif(au.raw_user_meta_data->>'name', ''),
              nullif(au.raw_user_meta_data->>'full_name', ''),
              case
                when u.username ~ '^user_[0-9a-f]{8}$' then null
                else nullif(u.username, '')
              end,
              split_part(coalesce(au.email, u.email, ''), '@', 1),
              '여행자'
            ),
            'avatar_color', '#4DB8E8'
          ) as author
        from questions qu
        join users u on u.id = qu.user_id
        left join auth.users au on au.id = qu.user_id
        left join places pl on pl.id = qu.place_id
        where (
            coalesce(pl.city, '') = p_city
            or (qu.place_id is null and qu.place_name like '%' || p_city || '%')
          )
          and qu.created_at > now() - interval '48 hours'
        order by qu.created_at desc
        limit 3
      ) q),
      '[]'::json
    )
  ) into result;

  return result;
end;
$function$;
