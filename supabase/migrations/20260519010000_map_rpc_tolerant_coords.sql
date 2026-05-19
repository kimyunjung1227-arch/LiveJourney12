-- 지도 RPC 좌표 추출을 관대하게 변경.
-- useUpload는 exif_data.{lat,lng} 평면으로 저장하고,
-- 레거시 createPostSupabase는 exif_data.map_pin.{lat,lng} 중첩으로 저장한다.
-- 원본 EXIF의 gpsLatitude/gpsLongitude도 폴백으로 지원.

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
      coalesce(
        (p.exif_data->>'photoDate')::timestamptz,
        (p.exif_data->>'taken_at')::timestamptz,
        p.captured_at,
        p.created_at
      ) as photo_at,
      coalesce(
        nullif(p.exif_data->'map_pin'->>'lat','')::double precision,
        nullif(p.exif_data->>'lat','')::double precision,
        nullif(p.exif_data->>'gpsLatitude','')::double precision
      ) as lat,
      coalesce(
        nullif(p.exif_data->'map_pin'->>'lng','')::double precision,
        nullif(p.exif_data->>'lng','')::double precision,
        nullif(p.exif_data->>'gpsLongitude','')::double precision
      ) as lng,
      (p.images->>0)::text as thumb_url
    from posts p
    where p.exif_data is not null
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
        and coalesce(
          (p2.exif_data->>'photoDate')::timestamptz,
          (p2.exif_data->>'taken_at')::timestamptz,
          p2.captured_at,
          p2.created_at
        ) > now() - interval '1 hour'
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

create or replace function public.get_bundle_detail(p_bundle_id text)
returns table (
  post_id uuid,
  photo_url text,
  thumbnail_url text,
  exif_taken_at timestamptz,
  body text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_hour text;
  v_lat_grid bigint;
  v_lng_grid bigint;
begin
  v_user_id := split_part(p_bundle_id, '_', 1)::uuid;
  v_hour := split_part(p_bundle_id, '_', 2);
  v_lat_grid := split_part(p_bundle_id, '_', 3)::bigint;
  v_lng_grid := split_part(p_bundle_id, '_', 4)::bigint;

  return query
  with photos as (
    select
      p.id,
      (p.images->>0)::text as photo_url,
      coalesce(
        (p.exif_data->>'photoDate')::timestamptz,
        (p.exif_data->>'taken_at')::timestamptz,
        p.captured_at,
        p.created_at
      ) as photo_at,
      p.content as body,
      coalesce(
        nullif(p.exif_data->'map_pin'->>'lat','')::double precision,
        nullif(p.exif_data->>'lat','')::double precision,
        nullif(p.exif_data->>'gpsLatitude','')::double precision
      ) as lat,
      coalesce(
        nullif(p.exif_data->'map_pin'->>'lng','')::double precision,
        nullif(p.exif_data->>'lng','')::double precision,
        nullif(p.exif_data->>'gpsLongitude','')::double precision
      ) as lng
    from posts p
    where p.exif_data is not null
      and p.user_id = v_user_id
  )
  select
    p.id, p.photo_url, p.photo_url, p.photo_at, p.body
  from photos p
  where p.lat is not null and p.lng is not null
    and to_char(date_trunc('hour', p.photo_at), 'YYYYMMDDHH24') = v_hour
    and floor(p.lat * 2000) = v_lat_grid
    and floor(p.lng * 2000) = v_lng_grid
    and p.photo_at > now() - interval '48 hours'
  order by p.photo_at asc;
end;
$$;

create or replace function public.get_recent_map_photos(
  p_sw_lat double precision,
  p_sw_lng double precision,
  p_ne_lat double precision,
  p_ne_lng double precision,
  p_limit int default 10
)
returns table (
  post_id uuid,
  thumbnail_url text,
  exif_taken_at timestamptz,
  author_name text,
  place_name text
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      p.id,
      (p.images->>0)::text as thumb_url,
      coalesce(
        (p.exif_data->>'photoDate')::timestamptz,
        (p.exif_data->>'taken_at')::timestamptz,
        p.captured_at,
        p.created_at
      ) as photo_at,
      coalesce(u.username, p.author_username, '익명') as author_name,
      coalesce(p.place_name, p.region, '') as place_name,
      coalesce(
        nullif(p.exif_data->'map_pin'->>'lat','')::double precision,
        nullif(p.exif_data->>'lat','')::double precision,
        nullif(p.exif_data->>'gpsLatitude','')::double precision
      ) as lat,
      coalesce(
        nullif(p.exif_data->'map_pin'->>'lng','')::double precision,
        nullif(p.exif_data->>'lng','')::double precision,
        nullif(p.exif_data->>'gpsLongitude','')::double precision
      ) as lng
    from posts p
    left join users u on u.id = p.user_id
    where p.exif_data is not null
  )
  select id, thumb_url, photo_at, author_name, place_name
  from base
  where lat is not null and lng is not null
    and photo_at > now() - interval '48 hours'
    and lat between p_sw_lat and p_ne_lat
    and lng between p_sw_lng and p_ne_lng
  order by photo_at desc
  limit p_limit;
$$;
