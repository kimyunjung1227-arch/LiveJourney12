-- 지도 화면용 RPC: 영역 내 게시물을 묶음(같은 user_id + 1시간 + GPS 50m 격자) 단위로 반환.
-- 스펙: 라이브저니 지도 화면 §5. posts/users 테이블의 실제 스키마에 맞춰 적용.

create or replace function public.get_map_bundles(
  p_sw_lat double precision,
  p_sw_lng double precision,
  p_ne_lat double precision,
  p_ne_lng double precision,
  p_category text default null
)
returns table (
  bundle_id text,
  primary_post_id uuid,
  primary_thumbnail text,
  primary_lat double precision,
  primary_lng double precision,
  primary_taken_at timestamptz,
  category text,
  bundle_count int,
  is_bundle boolean,
  author_id uuid,
  author_name text,
  author_avatar_color text,
  is_author_on_site boolean,
  place_name text,
  body text,
  likes_count int,
  comments_count int,
  saves_count int
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      p.id,
      p.user_id,
      p.category,
      p.content as body,
      coalesce(p.place_name, p.region, '') as place_name,
      p.author_username,
      coalesce(p.likes_count, 0) as likes_count,
      coalesce(p.comments_count, 0) as comments_count,
      coalesce((p.exif_data->>'photoDate')::timestamptz, p.captured_at, p.created_at) as photo_at,
      nullif(p.exif_data->'map_pin'->>'lat','')::double precision as lat,
      nullif(p.exif_data->'map_pin'->>'lng','')::double precision as lng,
      (p.images->>0)::text as thumb_url
    from posts p
    where p.exif_data ? 'map_pin'
  ),
  filtered as (
    select *
    from base
    where photo_at > now() - interval '48 hours'
      and lat is not null and lng is not null
      and lat between p_sw_lat and p_ne_lat
      and lng between p_sw_lng and p_ne_lng
      and (p_category is null or category = p_category)
  ),
  grouped as (
    select
      f.*,
      f.user_id::text || '_' ||
        to_char(date_trunc('hour', f.photo_at), 'YYYYMMDDHH24') || '_' ||
        floor(f.lat * 2000)::text || '_' ||
        floor(f.lng * 2000)::text as bundle_id_calc,
      row_number() over (
        partition by f.user_id, date_trunc('hour', f.photo_at), floor(f.lat * 2000), floor(f.lng * 2000)
        order by f.photo_at desc, f.id desc
      ) as rn,
      count(*) over (
        partition by f.user_id, date_trunc('hour', f.photo_at), floor(f.lat * 2000), floor(f.lng * 2000)
      ) as bundle_size
    from filtered f
  )
  select
    g.bundle_id_calc,
    g.id,
    g.thumb_url,
    g.lat,
    g.lng,
    g.photo_at,
    g.category,
    g.bundle_size::int,
    (g.bundle_size > 1),
    g.user_id,
    coalesce(u.username, g.author_username, '익명'),
    '#4DB8E8'::text,
    exists(
      select 1 from posts p2
      where p2.user_id = g.user_id
        and coalesce(p2.place_name, p2.region, '') = g.place_name
        and coalesce((p2.exif_data->>'photoDate')::timestamptz, p2.captured_at, p2.created_at) > now() - interval '1 hour'
        and p2.id <> g.id
    ),
    g.place_name,
    g.body,
    g.likes_count,
    g.comments_count,
    0
  from grouped g
  left join users u on u.id = g.user_id
  where g.rn = 1;
$$;

grant execute on function public.get_map_bundles(double precision, double precision, double precision, double precision, text) to anon, authenticated;
