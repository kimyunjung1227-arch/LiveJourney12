-- 질문/답변 작성자 이름을 users.username(예: "user_aba9e607" placeholder) 대신
-- 사용자가 직접 설정한 프로필 이름(profiles.username)으로 노출하고,
-- 프로필 사진(profiles.avatar_url)도 author에 포함하도록 수정.
-- 영향 RPC: get_questions_list / get_question_detail / get_search_hub / search_all

-- 1) 실시간 질문 목록
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

-- 2) 질문 상세 (질문 작성자 + 답변 작성자 모두 프로필 이름/사진 사용)
create or replace function public.get_question_detail(p_question_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  v_uid uuid := auth.uid();
begin
  select json_build_object(
    'question', (
      select row_to_json(q) from (
        select
          qu.id, qu.body, qu.created_at,
          coalesce(qu.answer_count, 0) as answer_count,
          (qu.user_id = v_uid) as is_my_question,
          json_build_object(
            'id', qu.user_id,
            'name', coalesce(nullif(pr.username, ''), nullif(u.username, ''), '익명'),
            'avatar_url', nullif(pr.avatar_url, ''),
            'avatar_color', '#4DB8E8'
          ) as author,
          case when qu.place_name is not null and qu.place_name <> ''
            then json_build_object('id', coalesce(qu.place_id::text, qu.place_name), 'name', qu.place_name)
            else null
          end as place,
          qu.category
        from questions qu
        left join users u on u.id = qu.user_id
        left join profiles pr on pr.id = qu.user_id
        where qu.id = p_question_id
      ) q
    ),
    'answers', coalesce(
      (select json_agg(a order by a.is_best desc, a.helpful_count desc, a.created_at asc) from (
        select
          qa.id as answer_id,
          coalesce(qa.is_best, false) as is_best,
          coalesce(qa.helpful_count, 0) as helpful_count,
          qa.created_at,
          json_build_object(
            'id', p.id,
            'photo_url', p.photo_url,
            'body', coalesce(p.content, ''),
            'exif_taken_at', coalesce(p.exif_taken_at, p.captured_at, p.created_at),
            'place_id', p.place_id
          ) as post,
          json_build_object(
            'id', u.id,
            'name', coalesce(nullif(pr.username, ''), nullif(u.username, ''), '익명'),
            'avatar_url', nullif(pr.avatar_url, ''),
            'avatar_color', '#4DB8E8',
            'helped_count', coalesce(u.helped_count, 0)
          ) as author,
          exists(
            select 1 from posts p2
            where p2.user_id = u.id
              and (
                (p.place_id is not null and p2.place_id = p.place_id)
                or (p.place_name is not null and p2.place_name = p.place_name)
              )
              and coalesce(p2.exif_taken_at, p2.captured_at, p2.created_at) > now() - interval '1 hour'
          ) as is_author_on_site,
          exists(
            select 1 from answer_helpful ah
            where ah.answer_id = qa.id and ah.user_id = v_uid
          ) as i_marked_helpful
        from question_answers qa
        join posts p on p.id = qa.post_id
        join users u on u.id = p.user_id
        left join profiles pr on pr.id = p.user_id
        where qa.question_id = p_question_id
      ) a),
      '[]'::json
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_question_detail(uuid) to anon, authenticated;

-- 3) 검색 허브의 실시간 질문 카드
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

-- 4) 통합 검색 결과의 질문
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
