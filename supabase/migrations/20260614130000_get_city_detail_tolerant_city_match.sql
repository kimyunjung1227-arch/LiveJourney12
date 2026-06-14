-- get_city_detail: 지역 화면 사진이 안 나오는 문제 수정.
-- 원인: city_live 가 city_resolved(coalesce(places.city, posts.region)) = p_city "정확 일치"를 요구.
--   그런데 posts.region 은 "경북 구미시 봉곡동", "칠곡군 약목면" 같은 상세 주소라,
--   지역 화면에 짧은 도시명("구미시","칠곡")이 넘어오면 매칭 실패 → 사진 0개.
-- 해결: 도시 매칭을 양방향 부분일치(ILIKE)로 완화. (사진/live_count/hot_places 가 모두 city_live 기반)
-- 함수 본문은 기존과 동일, city_live WHERE 절만 변경.

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
        where coalesce(pl.city, '') = p_city
           or (qu.place_id is null and qu.place_name like '%' || p_city || '%')
        order by qu.created_at desc
        limit 3
      ) q),
      '[]'::json
    )
  ) into result;

  return result;
end;
$function$;
