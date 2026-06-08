-- 질문 작성자가 자신의 질문을 삭제할 수 있도록 DELETE RLS 정책 추가.
--
-- 문제: questions 테이블에는 insert/select/update 정책만 있고 delete 정책이 없었다.
-- RLS가 켜진 상태에서 정책이 없으면 삭제가 거부되어, 작성자가 삭제를 눌러도
-- 0행만 영향받고(에러 없이) 실제 DB에서는 지워지지 않았다.
--
-- 해결: 작성자(auth.uid() = user_id)에게 DELETE 를 허용한다.
-- 하위 데이터(question_answers, answer_helpful)와 관련 알림(notifications.question_id)은
-- 모두 ON DELETE CASCADE 라 질문 삭제 시 함께 정리된다.

drop policy if exists "questions_delete_own" on public.questions;
create policy "questions_delete_own"
  on public.questions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- (보강) 기존 update 정책에 with check 추가 — 수정 시 user_id 변조로 다른 사용자에게
-- 행을 넘기는 것을 방지. (작성자 수정 기능과 함께 안전하게 유지)
drop policy if exists "questions_update_own" on public.questions;
create policy "questions_update_own"
  on public.questions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
