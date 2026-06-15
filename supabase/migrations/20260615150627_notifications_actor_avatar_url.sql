-- 알림 화면 actor(상대방) 프로필 사진 노출 수정
-- 문제: get_notifications RPC 의 actor json 에 avatar_url 이 빠져 있어,
--       ActivityNotice 가 항상 이니셜 폴백만 표시했음.
-- 수정: get_profile 과 동일한 우선순위로 avatar_url 을 actor 에 추가.
--       us(users).avatar_url → auth.users.raw_user_meta_data.avatar_url → .picture
-- 참고: 이 함수는 그동안 마이그레이션 파일 없이 원격에만 존재(드리프트)했으므로
--       전체 정의를 여기에 편입해 버전관리한다.

CREATE OR REPLACE FUNCTION public.get_notifications(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  result json;
begin
  if v_uid is null then
    return '[]'::json;
  end if;

  select coalesce(json_agg(n order by n.created_at desc), '[]'::json)
  into result
  from (
    select
      notif.id,
      notif.type,
      notif.post_id,
      notif.question_id,
      coalesce(notif.payload, '{}'::jsonb) as data,
      notif.message,
      coalesce(notif.is_read, false) as is_read,
      notif.created_at,
      case when notif.actor_user_id is not null then
        json_build_object(
          'id', actor.id,
          'name', coalesce(
            nullif(au.raw_user_meta_data->>'name', ''),
            nullif(au.raw_user_meta_data->>'full_name', ''),
            nullif(notif.actor_username, ''),
            case
              when actor.username ~ '^user_[0-9a-f]{8}$' then null
              else nullif(actor.username, '')
            end,
            split_part(coalesce(au.email, actor.email, ''), '@', 1),
            '여행자'
          ),
          -- 상대방이 프로필 사진으로 설정한 이미지 (get_profile 과 동일 우선순위)
          'avatar_url', coalesce(
            nullif(actor.avatar_url, ''),
            nullif(au.raw_user_meta_data->>'avatar_url', ''),
            nullif(au.raw_user_meta_data->>'picture', '')
          ),
          'avatar_color', '#4DB8E8'
        )
      else null end as actor,
      case when notif.post_id is not null then
        (select photo_url from posts where id = notif.post_id)
      else null end as post_thumbnail,
      case
        when notif.created_at >= date_trunc('day', now()) then 'today'
        when notif.created_at >= date_trunc('day', now()) - interval '7 days' then 'week'
        else 'earlier'
      end as time_group,
      case when notif.type = 'follow' and notif.actor_user_id is not null then
        exists(
          select 1 from follows
          where follower_id = v_uid and following_id = notif.actor_user_id
        )
      else null end as i_follow_back
    from notifications notif
    left join users actor on actor.id = notif.actor_user_id
    left join auth.users au on au.id = notif.actor_user_id
    where notif.user_id = v_uid
      and notif.type <> 'badge'   -- 뱃지 알림은 더 이상 노출하지 않음
    order by notif.created_at desc
    limit p_limit offset p_offset
  ) n;

  return result;
end;
$function$;
