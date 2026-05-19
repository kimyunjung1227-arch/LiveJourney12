-- 지도 영역의 최근 48시간 사진 캐러셀 데이터 (하단 시트용). 스펙 §5.

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
      coalesce((p.exif_data->>'photoDate')::timestamptz, p.captured_at, p.created_at) as photo_at,
      coalesce(u.username, p.author_username, '익명') as author_name,
      coalesce(p.place_name, p.region, '') as place_name,
      nullif(p.exif_data->'map_pin'->>'lat','')::double precision as lat,
      nullif(p.exif_data->'map_pin'->>'lng','')::double precision as lng
    from posts p
    left join users u on u.id = p.user_id
    where p.exif_data ? 'map_pin'
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

grant execute on function public.get_recent_map_photos(double precision, double precision, double precision, double precision, int) to anon, authenticated;
