# Live Journey (라이브저니)

> 검색에 잡히지 않는 지금의 정보를 여행자들끼리 실시간으로 주고받는 곳

**문서 버전**: v2 (베스트 컷 시스템 통합)

---

## 1. 프로젝트 본질

### 한 줄 설명
**"꽃이 졌더라"는 그만. 지금 거기 있는 사람이 보내는 진짜 정보.**

### 창업자의 페인 포인트
설레는 마음으로 갔는데 꽃은 이미 다 졌더라. 검색해서 본 정보는 3년 전 누군가의 글이었다. 지금의 그곳은 아무도 알려주지 않는다.

### 도메인
livejourney.co.kr

### 미션
**검색에 잡히지 않는 지금의 정보를 여행자들끼리 실시간으로 주고받는 곳**

### 네 가지 핵심 차별점

1. **EXIF 자동 인증** (시간 축): 카메라가 자동으로 기록하는 시간 메타데이터를 활용해 "지금"을 조작 불가능하게 증명.
2. **48시간 룰** (수명 축): EXIF 시간 기준 48시간이 지나면 라이브 피드에서 자동으로 사라짐.
3. **사진/영상 중심** (정보 축): 텍스트가 아니라 사진 자체가 정보.
4. **베스트 컷 시스템** (영예 축): 각 장소의 대표 사진을 사용자 반응으로 자동 선정. 작성자에게 "베스트 컷 작가" 영예 누적.

### 부차적 차별점
- **시즌 데이터베이스**: 작년 같은 시기 데이터로 올해 예측
- **공개 아카이브**: 사용자 프로필에 활동이 누적되어 신뢰 검증 가능
- **자영업자 매장 페이지 예외**: 매장 페이지는 영구 보관

---

## 2. 디자인 시스템

### 컬러

```css
/* 키컬러 - 행동/라이브 신호/영향력에만 사용 */
--key-color: #4DB8E8;
--key-bg-light: #E8F4FB;
--key-text-dark: #1A6EA8;

/* 베스트 컷 그라데이션 (예외적 사용) */
--gradient-best-cut: linear-gradient(135deg, #4DB8E8, #1A6EA8);
--gradient-best-cut-soft: linear-gradient(135deg, rgba(77,184,232,0.08), rgba(77,184,232,0.18));

/* 중성 컬러 */
--text-primary: #1F1F1F;
--text-secondary: #6B6B6B;
--text-tertiary: #B8B8B8;
--bg-surface: #F5F7FA;
--border-light: #E8E8E8;
--bg-card: #FFFFFF;

/* 보조 */
--error: #D85050;
--bg-dark: #0A0A0A;
```

**키컬러 사용 원칙**: 전체 면적의 5~10% 이내로 절제.

**카테고리에는 색을 입히지 않음**.

**그라데이션 예외 규칙**: 베스트 컷에만 키컬러 그라데이션 사용 허용. 베스트 컷 뱃지, 알림 카드, 아바타 인디케이터, 베스트 컷 작가 라벨에만 적용.

### 타이포그래피

폰트: **Pretendard** (1순위) / Apple SD Gothic Neo (fallback)

```css
--font-title: 22px/1.4, weight 700, letter-spacing -0.4px;
--font-heading: 17px/1.4, weight 600;
--font-subheading: 14px/1.4, weight 600;
--font-body: 13px/1.6, weight 400;
--font-caption: 11px/1.5, weight 500;
--font-label: 10px/1.4, weight 600, letter-spacing 0.5px, uppercase;
```

### 간격 시스템

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 14px;
--space-4: 18px;
--space-5: 24px;
```

### 모서리 둥글기

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 12px;
--radius-xl: 14px;
```

### 그림자

```css
--shadow-card: 0 1px 3px rgba(0,0,0,0.04);
--shadow-elevated: 0 4px 16px rgba(0,0,0,0.12);
--shadow-glow: 0 0 0 4px rgba(77, 184, 232, 0.2);
```

---

## 3. 컴포넌트 패턴

### 버튼

**주 버튼 (Primary)** - 화면당 1개
```html
<button style="background: #4DB8E8; color: white; border: none;
  padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 600;">
  사진 한 장 올리기
</button>
```

**보조 버튼 (Secondary)**
```html
<button style="background: white; color: #4DB8E8; border: 1.5px solid #4DB8E8;
  padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 600;">
  한 장 더 올리기
</button>
```

**칩 (Chip)** - 필터, 카테고리
- 활성: `background: #4DB8E8; color: white;`
- 일반: `background: white; border: 1px solid #E8E8E8;`

### 카드

**기본 카드**
```html
<div style="background: #F5F7FA; border-radius: 10px; padding: 12px;">
</div>
```

**강조 카드** - 키컬러 옅은 배경
```html
<div style="background: #E8F4FB; border-radius: 10px; padding: 14px;">
</div>
```

**베스트 컷 카드** - 키컬러 테두리 + 그라데이션 헤더
```html
<div style="background: white; border-radius: 14px; border: 1.5px solid #4DB8E8;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
  <div style="padding: 20px;">
    <div style="background: linear-gradient(135deg, #4DB8E8, #1A6EA8);
      padding: 5px 11px; border-radius: 11px;
      display: inline-flex; align-items: center; gap: 5px;">
      <i class="ti ti-crown" style="color: white;"></i>
      <span style="color: white; font-weight: 700;">여의도 한강공원 베스트 컷</span>
    </div>
    <!-- 사진, 작성자, 본문, 반응 -->
  </div>
</div>
```

### 뱃지 / 인디케이터

**EXIF 인증 뱃지** - 사진 위 좌상단
```html
<div style="background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 6px;
  display: flex; align-items: center; gap: 4px; backdrop-filter: blur(8px);">
  <i class="ti ti-shield-check" style="color: #4DB8E8;"></i>
  <span style="color: white; font-weight: 600;">23분 전</span>
</div>
```

**지금 현장 뱃지**
```html
<div style="background: #E8F4FB; padding: 3px 8px; border-radius: 6px;
  display: flex; align-items: center; gap: 4px;">
  <div style="width: 5px; height: 5px; background: #4DB8E8; border-radius: 50%;"></div>
  <span style="color: #1A6EA8; font-weight: 600;">지금 현장</span>
</div>
```

**라이브 인디케이터**
```html
<div style="display: flex; align-items: center; gap: 6px;">
  <div style="width: 6px; height: 6px; background: #4DB8E8; border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(77, 184, 232, 0.2);"></div>
  <span style="color: #1A6EA8;">지금 47장 라이브</span>
</div>
```

**HOT 뱃지**
```html
<div style="background: #1F1F1F; padding: 5px 12px; border-radius: 7px;
  display: flex; align-items: center; gap: 4px;">
  <i class="ti ti-flame" style="color: #4DB8E8;"></i>
  <span style="color: white; font-weight: 600;">HOT</span>
</div>
```

**베스트 컷 뱃지** - 사진 위
```html
<div style="background: linear-gradient(135deg, #4DB8E8, #1A6EA8);
  padding: 6px 12px; border-radius: 7px;
  display: flex; align-items: center; gap: 5px;">
  <i class="ti ti-crown" style="color: white;"></i>
  <span style="color: white; font-weight: 700;">베스트 컷</span>
</div>
```

**베스트 컷 작가 라벨** - 작성자 이름 옆
```html
<div style="background: linear-gradient(135deg, #4DB8E8, #1A6EA8);
  padding: 2px 7px; border-radius: 5px;
  display: flex; align-items: center; gap: 3px;">
  <i class="ti ti-crown" style="font-size: 9px; color: white;"></i>
  <span style="font-size: 9px; color: white; font-weight: 700;">베스트 컷 작가</span>
</div>
```

**아바타 베스트 컷 작가 인디케이터** - 우하단 작은 왕관
```html
<div style="width: 64px; height: 64px; border-radius: 50%;
  background: #4DB8E8; position: relative;">
  <div style="position: absolute; bottom: -2px; right: -2px;
    width: 22px; height: 22px; border-radius: 50%;
    background: linear-gradient(135deg, #4DB8E8, #1A6EA8);
    border: 2px solid white;
    display: flex; align-items: center; justify-content: center;">
    <i class="ti ti-crown" style="font-size: 11px; color: white;"></i>
  </div>
</div>
```

**영예 트러스트 카드**
```html
<div style="background: white; border: 1.5px solid #4DB8E8; border-radius: 11px;
  padding: 13px; display: flex; align-items: center; gap: 12px;">
  <i class="ti ti-award" style="font-size: 22px; color: #4DB8E8;"></i>
  <div style="flex: 1;">
    <p style="font-weight: 600;">김지혜님이 만든 영예</p>
    <p style="font-size: 10px; color: #6B6B6B;">
      이 베스트 컷으로 312명이 여의도를 결정했어요
    </p>
  </div>
  <button>팔로우</button>
</div>
```

### 카테고리 (6개)

```javascript
const CATEGORIES = [
  { id: 'nature',   label: '개화·자연',   icon: 'ti-flower' },
  { id: 'weather',  label: '날씨·체감',   icon: 'ti-cloud' },
  { id: 'event',    label: '이벤트·축제', icon: 'ti-calendar-event' },
  { id: 'crowd',    label: '혼잡도·대기', icon: 'ti-users' },
  { id: 'sunset',   label: '노을·야경',   icon: 'ti-moon' },
  { id: 'business', label: '영업·운영',   icon: 'ti-building-store' },
];
```

**아이콘 라이브러리**: Tabler Icons (`@tabler/icons-webfont`)

---

## 4. 핵심 디자인 원칙 (6가지)

### 1. 키컬러는 행동에만
CTA 버튼, 라이브 신호, 영향력 표시에만 사용.

### 2. 사진이 정보
사진이 텍스트보다 큰 비중. 사진 위 정보는 EXIF 시간 + 카테고리 + 장소명 최소화.

### 3. 여백이 메시지
정보 밀도가 낮을수록 신뢰감.

### 4. "지금"이 톤
모든 카피에 "지금" 의식.

### 5. 에러도 친절하게
사용자를 비난하지 않음.

### 6. 영예는 시각적이어야 함
베스트 컷 작가에게 가는 영예는 즉시 인식되어야 함. 그라데이션, 왕관, 큰 카드, 축하 알림 같은 강한 시각 장치 사용.

---

## 5. 베스트 컷 시스템

### 베스트 컷이란
각 장소의 사진 중 사용자 반응(좋아요 + 갈게요 + 저장)이 가장 많은 한 장. 그 장소를 대표하는 사진.

### 선정 알고리즘
**자동 선정**: 좋아요 + 갈게요 × 2 + 저장 × 1.5. 가장 높은 점수의 사진이 베스트 컷.

**48시간 룰과의 관계**: 베스트 컷도 EXIF 기준 48시간 후 라이브 피드에서 내려감. 단, 작성자 프로필에 영구 보관.

**자영업자 매장 페이지**: 베스트 컷도 영구 보관. 시즌별 누적.

### 베스트 컷 표시 4개 화면

**A. 장소 페이지** - 히어로 영역
- 통계 박스 아래, 카테고리 필터 위
- 320px 큰 사진 + 그라데이션 작성자 정보 오버레이
- 베스트 컷 뱃지 (우상단)
- 본문 + 반응 지표 강조 박스
- 영예 트러스트 카드

**B. 프로필 페이지**
- 아바타 우하단 작은 왕관 인디케이터
- 이름 옆 "베스트 컷 작가" 그라데이션 라벨
- 통계 4개 중 베스트 컷 N (그라데이션 배경)
- 대표 베스트 컷 가로 캐러셀 (각 사진 키컬러 테두리 + 왕관 뱃지)

**C. 알림 (영예 순간)**
- 키컬러 그라데이션 큰 카드 + 키컬러 테두리
- 우상단 큰 왕관 장식 (opacity 0.15)
- "축하해요! 여의도 한강공원 베스트 컷이 됐어요" 큰 헤더
- 미니 사진 카드 (장소 페이지로 이동)

**D. 홈 피드의 베스트 컷 카드**
- 키컬러 테두리 (1.5px)
- "여의도 한강공원 베스트 컷" 그라데이션 헤더 뱃지
- 작성자 이름 옆 베스트 컷 작가 라벨
- 반응 지표 키컬러 채움

### 호혜 구조

1. 사진 올림 → 2. 반응 받음 → 3. 베스트 컷 영예 알림 → 4. 프로필 누적 → 5. "베스트 컷 작가" 정체성 → 6. 강조 노출 → 7. 더 많은 영향력 → 8. 더 많은 사진

이 선순환이 라이브저니를 떠날 수 없게 만드는 핵심.

---

## 6. 화면 구조 (20개 화면)

### 메인 5개 탭
1. 홈 - 시간순 라이브 피드 (베스트 컷 카드 섞임)
2. 핫플 - 장소 랭킹 (1~3위 강조 / 4~20위 리스트)
3. 카메라 - 다크 UI + EXIF 안내
4. 지도 - 기본 + 핀 선택 상태
5. 프로필 - 베스트 컷 작가 인디케이터 포함

### 콘텐츠 흐름
6. 검색 - 탐색 허브
7. 카테고리 화면 - 사진 중심 그리드
8. 알림 - 영향력 + 베스트 컷 영예 알림
9. 정보 입력 - 카테고리 + 한 줄 설명
10. 업로드 완료 - 즉각 영향력

### 영향력 + 탐색
11. 풀스크린 - 사진 줌
12. 도시 페이지 - 홈 피드와 같은 시각 언어
13. 장소 페이지 - 베스트 컷 히어로 영역 포함
14. 시즌 캘린더 - 작년 비교
15. 실시간 질문 - GPS 매칭
16. 답변 작성 - 사진 첨부 강력 권장
17. 다른 사용자 프로필

### 프로필 + 자영업자
18. 설정 - 4섹션
19. 매장 페이지 - 공식 뱃지 + 시즌별 누적
20. 자영업자 대시보드 - 4지표 + 활동 그래프

---

## 7. 사용자 흐름 (진입점)

- 사진 → 풀스크린
- 작성자 이름/아바타 → 다른 사용자 프로필
- 위치명/장소명 → 장소 페이지
- 도시명 → 도시 페이지
- 카테고리 아이콘 → 카테고리 화면
- 베스트 컷 알림 탭 → 장소 페이지
- 베스트 컷 작가 라벨/왕관 탭 → 사용자 프로필
- 프로필 베스트 컷 사진 탭 → 풀스크린

---

## 8. 라이팅 가이드

### 톤
친절하고 따뜻하지만 과하지 않음. 기술 자랑 X. 사용자를 비난하지 않음.

### 자주 쓰는 문구
- "지금 N장 라이브"
- "지금 현장"
- "꽃이 졌더라는 그만"
- "당신의 한 장이 누군가에게"
- "당신의 한 장이 새 베스트 컷이 될 수도"
- "축하해요! 베스트 컷이 됐어요"
- "N님이 만든 영예"

### 절대 쓰지 말 것
- "여러분", "유저", "당사"
- "AI 기반"
- "최고의", "최첨단"

---

## 9. 비즈니스 컨텍스트

### 타겟 사용자
- 1차: 여행 계획 단계의 20~40대 (정보 소비자)
- 2차: 여행 중인 사람 (정보 생산자)
- 3차: 자영업자 (매장 영업)

### 초기 운영 전략
- 첫 도시: 제주 또는 서울 한강
- 6개월 수동 시드 운영 필수
- 1,000명 미만 광고 X
- 시즌 데이터 누적이 1년 후 진짜 가치

### 베스트 컷 초기 운영
- 첫 1년 데이터 부족 시 운영자 보조 큐레이션
- 자동 알고리즘 우선, 운영자 큐레이션은 보조
- 베스트 컷 작가에게 인터뷰 등 추가 보상

---

## 10. 5가지 스니저 스토리

1. **개화 구원** - "꽃 졌더라는 그만"
2. **한 장의 영향력 + 베스트 컷** - "내가 여의도 베스트 컷 작가야"
3. **EXIF 신뢰** - "카메라가 박은 시간은 거짓말을 못 합니다"
4. **작년 비교** - "작년의 그곳으로, 올해를 짠다"
5. **매장 라이브** - "줄 서기 전에, 안을 본다"

---

## 11. 코드 작성 시 주의사항

### 일반 원칙
- TypeScript strict mode
- 함수형 컴포넌트 + Hooks
- 접근성(a11y) 필수

### 디자인 토큰
- 인라인 스타일 대신 CSS 변수 사용
- 색상은 위 정의된 값만
- 간격은 5단계만

### 그라데이션 사용 제약
- 베스트 컷 관련 UI에만 사용
- 그 외는 단일 키컬러만
- 그라데이션 값 동일: `linear-gradient(135deg, #4DB8E8, #1A6EA8)`

### 반응형
- 모바일 우선 (max-width 380px 기준)
- 태블릿 (768px+): 카드 2열
- 데스크탑 (1024px+): 최대 너비 + 중앙 정렬

### 이미지 처리
- lazy loading
- placeholder #F5F7FA 단색
- EXIF 추출은 서버 사이드
- 베스트 컷 자동 선정 로직 서버 사이드

### 성능
- 홈 피드 무한 스크롤 + 가상화
- 사진 thumbnail 사용
- 베스트 컷 알림 푸시 우선

---

## 12. 자주 요청할 작업 패턴

### "X 화면에 우리 디자인 시스템 적용해줘"
1. 디자인 시스템 적용
2. 핵심 원칙 6가지 체크
3. 베스트 컷 화면이면 그라데이션 + 왕관 사용

### "베스트 컷 X 추가해줘"
1. 어느 화면인지 확인 (장소 페이지 / 프로필 / 알림 / 홈 피드)
2. 위 4개 화면 패턴 적용
3. 그라데이션 색상값 동일

### "사진 카드 만들어줘"
1. 일반 카드 vs 베스트 컷 카드 구분
2. 일반: 단일 키컬러, 표준 스타일
3. 베스트 컷: 키컬러 테두리 + 그라데이션 헤더 + 베스트 컷 작가 라벨

### "에러/빈/로딩 상태 추가해줘"
1. 빈 상태: 메시지 + 다음 행동 CTA
2. 에러: 본질 설명 + 다음 행동
3. 로딩: 스켈레톤 또는 라이브 인디케이터

---

## 13. 자주 묻는 질문

### 왜 키컬러가 하나만?
절제. 색이 많으면 진짜 중요한 행동이 묻힘.

### 왜 베스트 컷에만 그라데이션?
베스트 컷은 라이브저니의 최고 영예. 단일 키컬러보다 강력한 시각 차별 필요. 그라데이션은 베스트 컷의 시각 시그니처.

### 왜 베스트 컷 자동 선정?
사용자 집단의 판단이 가장 공정. 운영자 큐레이션은 편향 위험. 첫 1년은 데이터 부족 시 운영자 보조.

### 왜 베스트 컷도 48시간 후 내려가?
"지금"의 가치 유지. 단, 작성자 프로필에는 영구 보관해서 영예는 유지.

### 자영업자 매장 베스트 컷은?
영구 보관. 시즌별 매장 봄/여름/가을/겨울 베스트 컷 자동 누적. 1년 후 매장의 사계절 컬렉션 자산화.

### 왜 베스트 컷 알림이 그렇게 강조돼?
라이브저니의 가장 강한 보상 순간. 친구에게 자랑할 만한 시각 임팩트 필요.

---

**참고**: 새 결정이 생기면 이 문서를 업데이트해주세요. Claude Code는 매 세션 시작 시 이 파일을 자동으로 읽어 라이브저니의 맥락을 이해합니다.

**v2 업데이트**: 베스트 컷 시스템 통합. 4번째 핵심 차별점 추가, 그라데이션 예외 규칙, 베스트 컷 컴포넌트 패턴, 4개 화면 베스트 컷 디자인, 영예 호혜 구조 추가.
