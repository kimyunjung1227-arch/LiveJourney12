# 🚀 웹 앱 배포 가이드

GitHub에 올린 React 앱을 실제로 작동하는 웹사이트로 만들기 위한 가이드입니다.

## ⚠️ 왜 화면이 안 보이나요?

GitHub에 올린 것은 **소스 코드**입니다. React 앱은 **빌드(빌드)** 과정을 거쳐야 실제 웹사이트로 작동합니다.

---

## 🎯 방법 1: Netlify 자동 배포 (추천 - 가장 쉬움!)

### 1단계: Netlify 계정 및 GitHub 연결

1. **Netlify 접속**
   - https://app.netlify.com 접속
   - GitHub 계정으로 로그인/가입

2. **새 사이트 추가**
   - "Add new site" 버튼 클릭
   - "Import an existing project" 선택
   - "GitHub" 선택
   - GitHub 인증 완료

3. **저장소 선택**
   - 저장소 선택: `app` (또는 `kimyunjung1227-arch/app`)
   - "Import" 클릭

### 2단계: 빌드 설정

**Build settings:**
- **Base directory**: (비워두기)
- **Build command**: `npm install && npm run build`
- **Publish directory**: `dist`

### 3단계: 배포!

- "Deploy site" 클릭
- 1-2분 후 배포 완료!
- 생성된 URL 확인 (예: `https://random-name-123.netlify.app`)

### 4단계: 사이트 이름 변경 (선택사항)

- Site settings > Domain management
- "Change site name" 클릭
- 원하는 이름 입력 (예: `livejourney-web`)
- 최종 URL: `https://livejourney-web.netlify.app`

---

## 🎯 방법 2: Vercel 자동 배포

### 1단계: Vercel 계정 및 GitHub 연결

1. **Vercel 접속**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인/가입

2. **새 프로젝트 추가**
   - "Add New..." > "Project" 클릭
   - 저장소 선택: `app`

### 2단계: 빌드 설정

**Build Settings:**
- **Framework Preset**: Vite
- **Root Directory**: `./` (기본값)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 3단계: 배포!

- "Deploy" 클릭
- 1-2분 후 배포 완료!
- 생성된 URL 확인 (예: `https://app-abc123.vercel.app`)

---

## 🎯 방법 3: GitHub Pages (복잡함)

GitHub Pages는 React 앱 배포에 적합하지 않지만, 가능합니다.

### 1단계: GitHub Actions 워크플로우 생성

`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build
      run: npm run build
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### 2단계: GitHub Pages 설정

1. 저장소 Settings > Pages
2. Source: "GitHub Actions" 선택
3. 저장

### 3단계: 푸시 및 배포

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deployment"
git push
```

---

## ✅ 추천: Netlify 사용

**장점:**
- ✅ 가장 간단함
- ✅ 자동 배포 (git push 할 때마다 자동 업데이트)
- ✅ 무료
- ✅ 커스텀 도메인 지원
- ✅ HTTPS 자동 설정

**단계:**
1. Netlify 접속 → GitHub 연결
2. 저장소 선택 → 빌드 설정
3. 배포 완료!

---

## 📋 배포 후 확인 사항

1. ✅ 빌드가 성공했는지 확인
2. ✅ 생성된 URL로 접속 테스트
3. ✅ 모든 페이지가 정상 작동하는지 확인
4. ✅ 반응형 디자인이 잘 작동하는지 확인

---

## 🔧 문제 해결

### 빌드 실패 시

1. **로그 확인**
   - Netlify/Vercel 대시보드에서 빌드 로그 확인
   - 에러 메시지 확인

2. **일반적인 문제**
   - `npm install` 실패 → Node.js 버전 확인
   - 빌드 에러 → 코드 오류 확인
   - 경로 문제 → `vite.config.js` 확인

### 페이지가 깨져 보일 때

- 브라우저 캐시 삭제 (Ctrl+Shift+R)
- 빌드가 완전히 완료될 때까지 대기

---

## 🎉 완료!

배포가 완료되면 이제 이 링크를 공유할 수 있습니다:

```
https://your-site.netlify.app
```

또는

```
https://your-site.vercel.app
```

