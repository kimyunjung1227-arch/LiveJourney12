-- 시즌 상세 RPC: 기존 photo_at 별칭 버그 수정 + 상태(bucket)/d_day/days_left 보강
-- 호환성 유지: 반환 키(season/places/photos/photos_total)는 동일, season 객체 안에 status/d_day/days_left 추가

create or replace function public.get_season_detail(p_season_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_ids uuid[];
  v_place_names text[];
  result json;
begin
  select sh.related_place_ids, sh.related_place_names
    into v_place_ids, v_place_names
  from seasonal_highlights sh
  where sh.id = p_season_id;

  with live as (
    select
      p.id,
      p.place_id,
      p.place_name,
      p.photo_url,
      (p.images->>0) as first_image,
      coalesce(
        (p.exif_data->'tags'->>'DateTimeOriginal')::timestamptz,
        (p.exif_data->>'photoDate')::timestamptz,
        p.captured_at,
        p.exif_taken_at,
        p.created_at
      ) as photo_at
    from posts p
    where p.exif_data is not null
       or p.exif_taken_at is not null
       or p.is_live = true
  ),
  live_active as (
    select * from live
    where photo_at > now() - interval '48 hours'
      and (
        (v_place_ids is not null and place_id = any(v_place_ids))
        or (v_place_names is not null and place_name = any(v_place_names))
      )
  ),
  season_places as (
    select pl.id, pl.name, pl.city, pl.district,
      coalesce((
        select count(*)::int from live_active la
        where la.place_id = pl.id or la.place_name = pl.name
      ), 0) as live_count,
      (
        select coalesce(la.photo_url, la.first_image) from live_active la
        where la.place_id = pl.id or la.place_name = pl.name
        order by la.photo_at desc nulls last
        limit 1
      ) as thumbnail_url
    from places pl
    where (v_place_ids is not null and pl.id = any(v_place_ids))
       or (v_place_names is not null and pl.name = any(v_place_names))
  ),
  photo_rows as (
    select
      la.id as post_id,
      coalesce(la.photo_url, la.first_image) as thumbnail_url,
      la.photo_at as exif_taken_at
    from live_active la
    order by la.photo_at desc
    limit 30
  )
  select json_build_object(
    'season', (
      select row_to_json(s) from (
        select
          sh.id, sh.title, sh.period_label,
          coalesce(sh.peak_label, '절정') as peak_label,
          sh.cover_color_start, sh.cover_color_end,
          sh.curation_body, sh.category,
          sh.starts_at, sh.ends_at, sh.peak_ends_at,
          coalesce(
            (select count(*)::int from season_places),
            coalesce(array_length(sh.related_place_ids, 1), 0),
            coalesce(array_length(sh.related_place_names, 1), 0),
            0
          ) as place_count,
          coalesce((select count(*)::int from live_active), 0) as live_count,
          case
            when sh.starts_at <= current_date and coalesce(sh.peak_ends_at, sh.ends_at) >= current_date then 'peak'
            when sh.starts_at > current_date and sh.starts_at <= current_date + interval '14 days' then 'soon'
            when sh.starts_at > current_date + interval '14 days' then 'upcoming'
            when coalesce(sh.peak_ends_at, sh.ends_at) < current_date then 'past'
            else null
          end as status,
          case when sh.starts_at > current_date then (sh.starts_at - current_date)::int else null end as d_day,
          case
            when sh.starts_at <= current_date and coalesce(sh.peak_ends_at, sh.ends_at) >= current_date
              then (coalesce(sh.peak_ends_at, sh.ends_at) - current_date)::int
            else null
          end as days_left
        from seasonal_highlights sh
        where sh.id = p_season_id
      ) s
    ),
    'places', coalesce(
      (select json_agg(p order by p.live_count desc) from season_places p),
      '[]'::json
    ),
    'photos', coalesce(
      (select json_agg(ph) from photo_rows ph),
      '[]'::json
    ),
    'photos_total', coalesce((select count(*)::int from live_active), 0)
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_season_detail(uuid) to anon, authenticated;
