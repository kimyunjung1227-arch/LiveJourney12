# 🚀 GitHub Pages 설정 가이드

GitHub에 올린 앱을 실제로 화면에 보이게 하는 설정 방법입니다.

## ✅ 이미 완료된 작업

1. ✅ GitHub Actions 워크플로우 파일 생성 (`.github/workflows/deploy.yml`)
2. ✅ vite.config.js에 base 경로 설정 (`base: '/app/'`)
3. ✅ GitHub에 푸시 완료

## 🔧 GitHub Pages 활성화하기

이제 GitHub 웹사이트에서 설정만 하면 됩니다:

### 1단계: 저장소 Settings 접근

1. GitHub 저장소 페이지로 이동: https://github.com/kimyunjung1227-arch/app
2. 상단 메뉴에서 **"Settings"** 클릭
3. 왼쪽 사이드바에서 **"Pages"** 클릭

### 2단계: GitHub Pages 설정

**Source 설정:**
- **Source**: `GitHub Actions` 선택
  - (기존 워크플로우가 자동으로 배포를 처리합니다)

### 3단계: 저장 및 확인

1. 설정 저장 후, 잠시 기다립니다 (1-2분)
2. **"Actions"** 탭에서 배포 진행 상황을 확인할 수 있습니다
3. 배포가 완료되면 **"Pages"** 탭에서 사이트 URL이 표시됩니다

## 🌐 사이트 접속 URL

배포가 완료되면 다음 URL로 접속할 수 있습니다:

```
https://kimyunjung1227-arch.github.io/app/
```

## 📋 배포 상태 확인

1. **Actions 탭 확인**
   - https://github.com/kimyunjung1227-arch/app/actions
   - "Deploy to GitHub Pages" 워크플로우가 실행 중/완료 상태인지 확인

2. **Pages 탭 확인**
   - https://github.com/kimyunjung1227-arch/app/settings/pages
   - "Visit site" 버튼이 나타나면 배포 완료!

## 🔄 자동 배포

이제 `main` 브랜치에 코드를 푸시하면 자동으로 배포됩니다:

```bash
git add .
git commit -m "Update code"
git push origin main
```

## ⚠️ 문제 해결

### 배포가 안 될 때

1. **Actions 탭에서 에러 확인**
   - 빨간색 X 표시가 있으면 로그 확인

2. **일반적인 문제들**
   - `npm install` 실패 → package.json 확인
   - `npm run build` 실패 → 빌드 에러 메시지 확인
   - 권한 문제 → Settings > Actions > General에서 권한 확인

3. **수동 배포 실행**
   - Actions 탭에서 "Deploy to GitHub Pages" 워크플로우 선택
   - "Run workflow" 버튼 클릭

## 🎉 완료!

설정이 완료되면 위의 URL로 접속하여 앱을 확인할 수 있습니다!

