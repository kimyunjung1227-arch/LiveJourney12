-- 자동 답변: 사용자가 올린 게시물이 다른 사용자의 미해결 질문과 관련 있으면
-- (같은 장소 + 카테고리 호환 + 최근 질문) 자동으로 그 질문의 답변(question_answers)으로 연결한다.
-- 핵심 가치: "내가 올린 실시간 정보가 곧 누군가의 질문에 대한 답이 된다."
--
-- 매칭 기준
--   1) 장소: posts.place_id == questions.place_id (정확) 또는
--            정규화된 장소명(공백 제거·소문자) 양방향 부분일치
--   2) 카테고리: 둘 중 하나가 null 이거나 동일하면 호환
--   3) 최근 7일 이내 작성된 질문만 대상 (오래된 질문 스팸 방지)
--   4) 자기 자신의 질문에는 자동 답변하지 않음
--   5) 사진이 있는 게시물만 (사진이 정보)
--
-- 안전장치: 매칭 로직이 실패하더라도 게시물 INSERT 자체는 절대 막지 않는다(예외 무시).

create or replace function public.normalize_place_key(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(p, '')), '\s+', '', 'g');
$$;

create or replace function public.auto_answer_questions_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := new.user_id;
  v_post_place text;
begin
  -- 사진이 정보 — 대표 이미지 없는 글은 답변 후보 아님
  if coalesce(new.photo_url, '') = '' then
    return new;
  end if;

  v_post_place := public.normalize_place_key(coalesce(new.place_name, new.location, ''));
  if v_post_place = '' and new.place_id is null then
    return new; -- 장소 단서가 전혀 없으면 매칭 불가
  end if;

  -- 1) 관련 있는 미해결(최근) 질문에 자동 답변 연결
  insert into question_answers (question_id, post_id)
  select q.id, new.id
  from questions q
  left join places pl on pl.id = q.place_id
  where q.user_id <> v_uid
    and q.created_at > now() - interval '7 days'
    and (q.category is null or new.category is null or q.category = new.category)
    and (
      (new.place_id is not null and q.place_id = new.place_id)
      or (
        v_post_place <> ''
        and public.normalize_place_key(coalesce(pl.name, q.place_name, '')) <> ''
        and (
          public.normalize_place_key(coalesce(pl.name, q.place_name, '')) = v_post_place
          or v_post_place like '%' || public.normalize_place_key(coalesce(pl.name, q.place_name, '')) || '%'
          or public.normalize_place_key(coalesce(pl.name, q.place_name, '')) like '%' || v_post_place || '%'
        )
      )
    )
  on conflict (question_id, post_id) do nothing;

  -- 2) 답변이 연결된 질문의 카운터/플래그 갱신
  update questions q
  set answer_count = (select count(*) from question_answers qa where qa.question_id = q.id),
      is_answered = true
  where q.id in (select question_id from question_answers where post_id = new.id);

  -- 3) 질문 작성자에게 "내 질문에 답이 올라왔어요" 알림
  insert into notifications (user_id, recipient_id, recipient_user_id, type, question_id, actor_user_id)
  select q.user_id, q.user_id, q.user_id, 'question_answered', q.id, v_uid
  from questions q
  where q.id in (select question_id from question_answers where post_id = new.id)
    and q.user_id <> v_uid;

  return new;
exception
  when others then
    -- 자동 답변 매칭이 업로드를 막지 않도록 안전하게 무시
    return new;
end;
$$;

drop trigger if exists trg_auto_answer_questions on public.posts;
create trigger trg_auto_answer_questions
after insert on public.posts
for each row execute function public.auto_answer_questions_on_post();
