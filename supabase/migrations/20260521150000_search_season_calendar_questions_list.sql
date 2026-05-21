-- 시즌 캘린더 / 질문 전체 목록 RPC
-- 검색 화면의 진입 카드(시즌 캘린더, 실시간 질문) 전체 보기 화면용

create or replace function public.get_season_calendar()
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
  seasons as (
    select
      sh.id,
      sh.title,
      sh.period_label,
      sh.category,
      sh.cover_color_start,
      sh.cover_color_end,
      sh.starts_at,
      sh.ends_at,
      coalesce((
        select count(*)::int from live_active la
        where la.place_name = any(sh.related_place_names)
      ), 0) as live_count,
      coalesce(array_length(sh.related_place_names, 1), 0) as place_count,
      case
        when sh.starts_at > current_date then 'upcoming'
        when sh.ends_at < current_date then 'ended'
        else 'active'
      end as status,
      case
        when sh.starts_at > current_date then (sh.starts_at - current_date)::int
        when sh.ends_at >= current_date then (sh.ends_at - current_date)::int
        else null
      end as days_delta,
      sh.display_order
    from seasonal_highlights sh
    where sh.is_active = true
  )
  select json_build_object(
    'today', to_char(current_date, 'YYYY-MM-DD'),
    'total_live', (select count(*)::int from live_active),
    'total_active', (select count(*)::int from seasons where status = 'active'),
    'total_upcoming', (select count(*)::int from seasons where status = 'upcoming'),
    'active', coalesce(
      (select json_agg(s order by s.display_order, s.starts_at) from seasons s where s.status = 'active'),
      '[]'::json
    ),
    'upcoming', coalesce(
      (select json_agg(s order by s.starts_at, s.display_order) from seasons s where s.status = 'upcoming'),
      '[]'::json
    ),
    'ended', coalesce(
      (select json_agg(s order by s.ends_at desc) from seasons s where s.status = 'ended'),
      '[]'::json
    )
  );
$$;

grant execute on function public.get_season_calendar() to anon, authenticated;

create or replace function public.get_questions_list(
  p_filter text default 'all',
  p_limit int default 30,
  p_offset int default 0
)
returns json
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select q.*, u.username
    from questions q
    left join users u on u.id = q.user_id
    where
      case
        when p_filter = 'waiting' then coalesce(q.is_answered, false) = false
        when p_filter = 'answered' then coalesce(q.is_answered, false) = true
        else true
      end
    order by q.created_at desc
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 100)
  ),
  counts as (
    select
      count(*)::int as total,
      count(*) filter (where coalesce(is_answered, false) = false)::int as waiting,
      count(*) filter (where coalesce(is_answered, false) = true)::int as answered
    from questions
  )
  select json_build_object(
    'counts', (select to_jsonb(c) from counts c),
    'items', coalesce(
      (select json_agg(json_build_object(
        'id', f.id,
        'body', f.body,
        'created_at', f.created_at,
        'category', f.category,
        'answer_count', coalesce(f.answer_count, 0),
        'is_answered', coalesce(f.is_answered, false),
        'author', json_build_object(
          'id', f.user_id,
          'name', coalesce(f.username, '익명'),
          'avatar_color', '#4DB8E8'
        ),
        'place', case
          when f.place_name is not null and f.place_name <> ''
            then json_build_object('id', f.place_name, 'name', f.place_name)
          else null
        end
      ) order by f.created_at desc) from filtered f),
      '[]'::json
    )
  );
$$;

grant execute on function public.get_questions_list(text, int, int) to anon, authenticated;
