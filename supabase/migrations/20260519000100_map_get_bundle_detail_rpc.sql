-- 묶음 ID로 그 묶음의 모든 사진을 시간순으로 조회. 스펙 §5.

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
      coalesce((p.exif_data->>'photoDate')::timestamptz, p.captured_at, p.created_at) as photo_at,
      p.content as body,
      nullif(p.exif_data->'map_pin'->>'lat','')::double precision as lat,
      nullif(p.exif_data->'map_pin'->>'lng','')::double precision as lng
    from posts p
    where p.exif_data ? 'map_pin'
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

grant execute on function public.get_bundle_detail(text) to anon, authenticated;
