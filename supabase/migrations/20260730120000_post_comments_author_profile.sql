-- 댓글 작성자 표시 정보(닉네임 / 프로필 사진)를 실제 사용자 프로필 기준으로 해석해서 내려준다.
--
-- 문제
--   post_comments.username / avatar_url 은 "작성 시점 스냅샷"이라
--   가입 계정 이름(이메일 앞부분, OAuth 계정명, user_xxxxxxxx 플레이스홀더)이 그대로 굳어 있고,
--   나중에 프로필 이름/사진을 바꿔도 과거 댓글에는 반영되지 않았다.
--
-- 해결
--   1) profiles 를 auth 메타데이터(사용자가 편집한 name/picture)와 계속 동기화 (UPDATE 트리거 + 백필)
--   2) get_post_comments RPC 가 get_notifications 와 동일한 우선순위로 표시 정보를 해석해 반환
--      (프로필 편집값 → profiles → users → 댓글 스냅샷 → 이메일 앞부분)

-- ============================================================
-- 1) auth.users 메타데이터 변경 → public.profiles 동기화
--    (기존 트리거는 INSERT 시점만 처리해서, 프로필 편집 후 profiles 가 낡은 값으로 남아 있었다)
-- ============================================================
create schema if not exists internal;

create or replace function internal.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
  v_avatar text;
begin
  -- 로그인마다 갱신되는 last_sign_in_at 등에는 반응하지 않는다
  if new.raw_user_meta_data is not distinct from old.raw_user_meta_data then
    return new;
  end if;

  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'username', '')
  );
  v_avatar := coalesce(
    nullif(new.raw_user_meta_data->>'picture', ''),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  );

  insert into public.profiles as p (id, username, avatar_url)
  values (new.id, v_name, v_avatar)
  on conflict (id) do update
  set
    username = coalesce(v_name, p.username),
    -- picture 키가 명시적으로 들어온 편집이면 null(기본 이미지 선택)도 그대로 반영
    avatar_url = case
      when jsonb_exists(new.raw_user_meta_data, 'picture') then v_avatar
      else coalesce(v_avatar, p.avatar_url)
    end;

  return new;
end $$;

drop trigger if exists on_auth_user_updated_profile on auth.users;
create trigger on_auth_user_updated_profile
after update on auth.users
for each row execute function internal.sync_profile_from_auth_user();

-- 이미 프로필을 편집한 사용자들 백필 (profiles 가 가입 시점 값으로 멈춰 있던 케이스)
update public.profiles p
set
  username = coalesce(
    nullif(au.raw_user_meta_data->>'name', ''),
    nullif(au.raw_user_meta_data->>'full_name', ''),
    p.username
  ),
  avatar_url = coalesce(
    nullif(au.raw_user_meta_data->>'picture', ''),
    nullif(au.raw_user_meta_data->>'avatar_url', ''),
    p.avatar_url
  )
from auth.users au
where au.id = p.id;

-- ============================================================
-- 2) 댓글 목록 RPC: 작성자 표시 정보 서버 해석
--    반환 키는 기존 post_comments 조회 결과와 동일하게 유지해서 클라이언트 매핑을 그대로 쓴다.
-- ============================================================
create or replace function public.get_post_comments(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  result json;
begin
  if p_post_id is null then
    return '[]'::json;
  end if;

  select coalesce(json_agg(c order by c.created_at asc), '[]'::json)
  into result
  from (
    select
      pc.id,
      pc.post_id,
      pc.user_id,
      pc.parent_comment_id,
      pc.content,
      pc.created_at,
      pc.updated_at,
      coalesce(pc.likes_count, 0) as likes_count,
      -- 표시 이름: 사용자가 직접 설정한 프로필 이름이 최우선
      coalesce(
        nullif(au.raw_user_meta_data->>'name', ''),
        nullif(au.raw_user_meta_data->>'full_name', ''),
        nullif(pr.username, ''),
        case when us.username ~ '^user_[0-9a-f]{8}$' then null else nullif(us.username, '') end,
        nullif(pc.username, ''),
        nullif(split_part(coalesce(au.email, us.email, ''), '@', 1), ''),
        '여행자'
      ) as username,
      -- 프로필 사진: 편집한 사진(picture) → profiles → users → OAuth 원본 → 작성 시점 스냅샷
      coalesce(
        nullif(au.raw_user_meta_data->>'picture', ''),
        nullif(pr.avatar_url, ''),
        nullif(us.avatar_url, ''),
        nullif(au.raw_user_meta_data->>'avatar_url', ''),
        nullif(pc.avatar_url, '')
      ) as avatar_url,
      (v_uid is not null and exists (
        select 1 from post_comment_likes pcl
        where pcl.comment_id = pc.id and pcl.user_id = v_uid
      )) as liked_by_me,
      coalesce((
        select count(*)::int from posts po where po.user_id = pc.user_id
      ), 0) as post_count,
      (pc.user_id is not null and pc.user_id = (
        select po2.user_id from posts po2 where po2.id = pc.post_id
      )) as is_author
    from post_comments pc
    left join auth.users au on au.id = pc.user_id
    left join profiles pr on pr.id = pc.user_id
    left join users us on us.id = pc.user_id
    where pc.post_id = p_post_id
    order by pc.created_at asc
  ) c;

  return result;
end $$;

grant execute on function public.get_post_comments(uuid) to anon, authenticated;
