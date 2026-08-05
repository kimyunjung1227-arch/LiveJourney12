-- 검색 화면 "여행자" 탭 전용 RPC
--
-- 화면 구조: 프로필 사진 · 이름 · 올린 게시물 수 + 우측 팔로우 버튼 (1인 1행)
--  · recommended(추천 여행자) : 아직 팔로우하지 않은 사람 중 "지금 활발한" 순
--                               (48h 라이브 수 × 5 + 뱃지 × 3 + 총 게시물 수)
--  · popular(인기 여행자)     : 팔로워 많은 순. 추천에 이미 뜬 사람은 제외해 중복 노출 방지.
--
-- 프로필은 48h 노출 룰의 예외이므로 여행자 자체를 시간창으로 걸러내지 않고,
-- 게시물 1개 이상 올린(활동 이력이 있는) 여행자만 후보로 삼는다.
-- is_following 은 auth.uid() 기준으로 서버에서 계산해 프런트가 추가 질의 없이 버튼 상태를 그린다.

create or replace function public.get_traveler_hub(p_limit int default 10)
returns json
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  post_stats as (
    select
      p.user_id as uid,
      count(*)::int as post_count,
      count(*) filter (
        where coalesce(p.exif_taken_at, p.captured_at, p.created_at) > now() - interval '48 hours'
      )::int as live_count,
      max(coalesce(p.exif_taken_at, p.captured_at, p.created_at)) as last_post_at
    from posts p
    where p.user_id is not null
    group by p.user_id
  ),
  follow_counts as (
    select following_id as uid, count(*)::int as follower_count
    from follows
    group by following_id
  ),
  base as (
    select
      pr.id,
      coalesce(nullif(pr.username, ''), nullif(u.username, ''), '여행자') as name,
      nullif(pr.avatar_url, '') as avatar_url,
      ps.post_count,
      ps.live_count,
      ps.last_post_at,
      coalesce(fc.follower_count, 0) as follower_count,
      coalesce(array_length(pr.earned_badges, 1), 0) as badge_count,
      exists (
        select 1 from follows f
        where f.follower_id = (select uid from me)
          and f.following_id = pr.id
      ) as is_following
    from profiles pr
    join post_stats ps on ps.uid = pr.id
    left join users u on u.id = pr.id
    left join follow_counts fc on fc.uid = pr.id
    where ps.post_count > 0
      and ((select uid from me) is null or pr.id <> (select uid from me))
  ),
  recommended as (
    select
      b.*,
      (b.live_count * 5 + b.badge_count * 3 + b.post_count) as score
    from base b
    where not b.is_following
    order by score desc, b.last_post_at desc nulls last
    limit greatest(p_limit, 1)
  ),
  popular as (
    select b.*
    from base b
    where b.id not in (select r.id from recommended r)
    order by b.follower_count desc, b.post_count desc, b.last_post_at desc nulls last
    limit greatest(p_limit, 1)
  )
  select json_build_object(
    'recommended', coalesce((
      select json_agg(
        json_build_object(
          'id', r.id,
          'name', r.name,
          'avatar_url', r.avatar_url,
          'post_count', r.post_count,
          'live_count', r.live_count,
          'follower_count', r.follower_count,
          'is_following', r.is_following
        )
        order by r.score desc, r.last_post_at desc nulls last
      )
      from recommended r
    ), '[]'::json),
    'popular', coalesce((
      select json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'avatar_url', p.avatar_url,
          'post_count', p.post_count,
          'live_count', p.live_count,
          'follower_count', p.follower_count,
          'is_following', p.is_following
        )
        order by p.follower_count desc, p.post_count desc
      )
      from popular p
    ), '[]'::json)
  );
$$;

grant execute on function public.get_traveler_hub(int) to anon, authenticated;
