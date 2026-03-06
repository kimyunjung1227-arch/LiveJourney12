# 💻 LiveJourney Web App (개발 확인용)

> ⚠️ **중요**: 이 웹 앱은 개발 진행사항을 확인하기 위한 **개발용 도구**입니다.  
> 실제 서비스는 **모바일 앱**(`mobile/`)을 사용합니다.

## 🎯 목적

웹 앱은 다음 목적으로 사용됩니다:

- ✅ 개발 중인 기능을 브라우저에서 빠르게 확인
- ✅ UI/UX 프로토타입 테스트
- ✅ 개발 진행사항 시각적 확인
- ✅ 모바일 앱 개발 전 사전 검증

**실제 사용자에게 제공하는 서비스가 아닙니다.**

---

## 🌐 라이브 데모

> ⚡ **빠른 배포**: 다른 사람들과 바로 공유하려면 [빠른 배포 가이드](./QUICK_DEPLOY.md)를 확인하세요! (5분 안에 완료)

### 배포 방법

**방법 1: Netlify (추천 - 가장 빠름!)**
- [빠른 배포 가이드](./QUICK_DEPLOY.md) 참고
- 3-5분 안에 공유 가능한 URL 생성

**방법 2: Vercel**
- [빠른 배포 가이드](./QUICK_DEPLOY.md) 참고
- Netlify 대안

**방법 3: GitHub Pages (직접 설정)**
- [간단 가이드](./GITHUB_PAGES_SIMPLE.md) - 5분 안에 직접 설정하는 방법
- [상세 가이드](./GITHUB_PAGES_SETUP.md) - 더 자세한 설명

---

## 🚀 실행하기

### 1. 저장소 클론 (다른 사람이 사용하는 경우)

```bash
git clone https://github.com/kimyunjung1227-arch/app.git
cd app
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 시작

```bash
npm run dev
```

→ **http://localhost:3000** 접속 (포트 3000으로 설정되어 있음)

### 4. 빌드 (프로덕션)

```bash
npm run build
```

→ `dist/` 폴더에 빌드 파일 생성

### 5. 빌드 결과 미리보기

```bash
npm run preview
```

→ 빌드된 결과를 로컬에서 확인

---

## 📁 프로젝트 구조

```
web/
├── src/
│   ├── pages/          # 화면 컴포넌트
│   ├── components/     # 공통 컴포넌트
│   │   └── DevBanner.jsx  # 개발용 배너
│   ├── contexts/       # Context API
│   ├── api/            # API 호출
│   └── utils/          # 유틸리티 함수
├── public/             # 정적 파일
└── dist/               # 빌드 결과물
```

---

## 🔧 개발 환경

- **React 18** + **Vite**
- **Tailwind CSS**
- **React Router** (라우팅)

---

## ⚙️ 환경 변수 (선택사항)

환경 변수 파일(`.env`)을 생성하여 API 키를 설정할 수 있습니다:

```env
# .env 파일 생성 (선택사항) — Vercel 배포 시에도 동일 키를 Environment Variables에 추가
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_KAKAO_MAP_API_KEY=your_kakao_map_api_key
VITE_KMA_API_KEY=your_kma_api_key
VITE_API_URL=http://localhost:5000
```
- **VITE_KMA_API_KEY**: 기상청 API (공공데이터포털 data.go.kr → 기상청_초단기실황) 발급 후 입력 시 업로드/검색/지역별 날씨 표시 가능

**참고**: 
- 환경 변수 없이도 기본값으로 동작합니다
- Kakao Map API 키는 기본값이 포함되어 있어 바로 사용 가능합니다
- `.env` 파일은 Git에 업로드되지 않습니다 (`.gitignore`에 포함)

## ⚠️ 주의사항

1. **웹 앱은 프로토타입입니다**
   - 모든 기능이 완전하지 않을 수 있습니다
   - 최종 구현은 모바일 앱에 있습니다

2. **모바일 앱이 기준입니다**
   - 모바일 앱(`mobile/`)이 실제 서비스의 기준입니다
   - 웹 앱과 모바일 앱 간 차이가 있을 수 있습니다

3. **배포하지 않습니다**
   - 웹 앱은 로컬 개발용입니다
   - 실제 서비스 배포 대상이 아닙니다

## 📦 업로드 체크리스트

GitHub에 올릴 때 어떤 파일을 포함해야 하는지 확인하려면:
- [업로드 체크리스트](./UPLOAD_CHECKLIST.md) 참고

---

## 🔗 관련 문서

- [프로젝트 구조 가이드](../PROJECT_STRUCTURE.md) - 전체 프로젝트 구조 및 역할
- [모바일 앱 README](../mobile/README.md) - 메인 앱 정보
- [메인 README](../README.md) - 프로젝트 전체 개요

---

**✅ 핵심 원칙**: 웹 앱 = 개발 확인용, 모바일 앱 = 메인

























