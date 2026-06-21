-- 질문을 장소 없이(제목+내용만) 생성할 수 있도록 questions.place_id 를 nullable 로 보장.
--
-- 배경: 질문 작성 화면을 '장소 선택' 대신 '제목 + 내용' 구조로 변경.
--   사람들은 보통 "제주도 날씨 어때요?"처럼 장소를 특정하지 않고 묻기 때문.
--   create_question(p_body, p_place_id, p_category) 는 그대로 두되,
--   프론트는 p_place_id = null 로 호출한다. 이때 place_id 가 NOT NULL 이면 실패하므로
--   컬럼을 (없으면 생성 + ) nullable 로 만든다.
--
-- 주의: place_id 컬럼이 마이그레이션 이력에 없이 대시보드에서 추가됐을 수 있어
--   add column if not exists 로 모든 환경에서 안전하게 존재를 보장한 뒤 NOT NULL 을 해제한다.

alter table public.questions
  add column if not exists place_id uuid;

alter table public.questions
  alter column place_id drop not null;

-- place_name 도 장소 없는 질문에서는 비어 있으므로 nullable 유지 확인 (대개 이미 nullable)
alter table public.questions
  alter column place_name drop not null;
