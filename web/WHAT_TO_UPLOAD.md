# 📤 업로드해야 할 파일 정리

## ✅ 올려야 할 것 (자동으로 포함됨)

현재 `web` 폴더 안에 있는 파일들 중에서:

### 1. **소스 코드** (가장 중요!)
- ✅ `src/` 폴더 전체
  - 모든 화면 (`src/pages/`)
  - 모든 컴포넌트 (`src/components/`)
  - 모든 유틸리티 (`src/utils/`)
  - 모든 API 코드 (`src/api/`)

### 2. **정적 파일**
- ✅ `public/` 폴더 전체
  - 로고, 아이콘, 이미지 등

### 3. **설정 파일**
- ✅ `package.json` - 필요한 라이브러리 목록
- ✅ `package-lock.json` - 정확한 버전 고정
- ✅ `vite.config.js` - 빌드 설정
- ✅ `tailwind.config.js` - 스타일 설정
- ✅ `index.html` - 메인 HTML
- ✅ `README.md` - 프로젝트 설명
- ✅ `.gitignore` - 제외할 파일 목록

### 4. **기타**
- ✅ `capacitor.config.json`
- ✅ `netlify.toml`, `vercel.json` (배포 설정)
- ✅ 문서 파일들 (`.md` 파일들)

---

## ❌ 올리지 말아야 할 것 (자동으로 제외됨)

`.gitignore` 파일이 이미 설정되어 있어서 자동으로 제외됩니다:

- ❌ `node_modules/` - npm install로 설치
- ❌ `dist/` - npm run build로 생성
- ❌ `.env` - 환경 변수 (민감한 정보)
- ❌ `android/`, `ios/` - 네이티브 빌드 파일
- ❌ 로그 파일, 캐시 파일 등

---

## 🚀 다른 사람들이 사용하는 방법

저장소를 올린 후, 다른 사람들은 이렇게 사용합니다:

```bash
# 1. 저장소 클론
git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
cd REPO_NAME

# 2. 의존성 설치 (자동으로 node_modules 생성)
npm install

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 확인
# http://localhost:5173 접속
```

---

## 📋 간단 요약

**올리는 것:**
- ✅ `src/` - 모든 코드
- ✅ `public/` - 이미지, 로고 등
- ✅ `package.json` - 설정 파일들
- ✅ 문서 파일들

**올리지 않는 것:**
- ❌ `node_modules/` (자동 제외)
- ❌ `dist/` (자동 제외)
- ❌ `.env` (자동 제외)

`.gitignore`가 이미 설정되어 있어서, 그냥 `git add .` 하면 필요한 것만 자동으로 포함됩니다!

---

## ✅ 최종 확인

```bash
cd web
git status
```

이 명령어를 실행하면 업로드될 파일 목록이 나옵니다.
`node_modules`, `dist`, `.env` 같은 것들이 목록에 없으면 정상입니다!

