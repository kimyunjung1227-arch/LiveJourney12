-- 보안 강화: posts 테이블 쓰기 정책을 "소유자(+관리자)" 기준으로 정리.
--
-- 문제: 반복된 대시보드 편집으로 INSERT/UPDATE/DELETE 에 USING/CHECK 가 true 이거나
--       anon 대상인 정책이 다수 누적(posts_*_all, *_unified, allow_public_*, *_system 등).
--       RLS 는 정책을 OR 로 결합하므로, true 정책 하나라도 있으면 누구나(심지어 비로그인)
--       모든 글을 수정/삭제/위조-작성 가능. = 심각한 보안 구멍.
--
-- 안전성:
--  - 좋아요/댓글 카운트(posts.likes_count/comments_count)는 post_likes/post_comments 의
--    SECURITY DEFINER 트리거(소유자 postgres, BYPASSRLS)가 갱신 → owner-only 로 잠가도 정상.
--  - 비소유자 글의 지도 핀 좌표 백필(MapScreen)만 직접 update 였는데,
--    아래 backfill_post_map_pin RPC(definer, 핀 좌표만 병합)로 대체.
--  - 공개 읽기(피드/비로그인 열람)는 유지: SELECT 는 anon+authenticated 에 true.

-- 1) posts 의 기존 정책을 모두 제거(이름이 제각각이라 동적으로 일괄 드롭)
do $$
declare
  r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'posts'
  loop
    execute format('drop policy if exists %I on public.posts', r.policyname);
  end loop;
end $$;

alter table public.posts enable row level security;

-- 2) 깨끗한 최소 정책 집합
-- 읽기: 공개 (실시간 피드/비로그인 열람)
create policy posts_select_public on public.posts
  for select to anon, authenticated
  using (true);

-- 작성: 로그인 사용자가 "본인 명의"로만
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (auth.uid() = user_id);

-- 수정: 본인 글만 (USING + WITH CHECK 둘 다 — user_id 재할당 방지)
create policy posts_update_own on public.posts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 삭제: 본인 글 또는 관리자
create policy posts_delete_own_or_admin on public.posts
  for delete to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() in (select user_id from public.admin_users)
  );

-- 3) 지도 핀 좌표 백필용 안전 RPC
--    (비소유자 글의 exif_data 전체를 덮어쓰지 않고 lat/lng/map_pin 만 병합)
create or replace function public.backfill_post_map_pin(
  p_post_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_post_id is null or p_lat is null or p_lng is null then
    return;
  end if;
  update public.posts
    set exif_data = coalesce(exif_data, '{}'::jsonb)
      || jsonb_build_object(
           'lat', p_lat,
           'lng', p_lng,
           'map_pin', jsonb_build_object('lat', p_lat, 'lng', p_lng)
         )
    where id = p_post_id;
end;
$$;

grant execute on function public.backfill_post_map_pin(uuid, double precision, double precision) to authenticated;
