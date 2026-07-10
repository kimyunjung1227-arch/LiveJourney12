-- ────────────────────────────────────────────────
-- get_search_hub — 인기 도시 카드에 '지금 올라온 사진' 썸네일 추가
--  기존: 도시별 정적 기본 이미지(프런트 getRegionDefaultImage) 사용
--  변경: 해당 지역에서 48h 내 가장 최근 올라온 사진(images[0])을 대표 썸네일로 노출
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
      ) as photo_at,
      (p.images->>0)::text as thumb_url
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
    select
      region as city,
      count(*)::int as live_count,
      -- 해당 지역에서 가장 최근 올라온 사진을 대표 썸네일로
      (array_agg(thumb_url order by photo_at desc)
        filter (where thumb_url is not null and thumb_url <> ''))[1] as thumbnail_url
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
