# 🚀 GitHub Pages로 앱 화면 보이게 만들기 (직접 하기)

GitHub 저장소에 있는 앱을 직접 설정해서 웹에서 볼 수 있게 만드는 방법입니다.

## ✅ 준비 사항 (이미 완료됨)

다음은 이미 설정되어 있습니다:
- ✅ GitHub Actions 워크플로우 파일 (`.github/workflows/deploy.yml`)
- ✅ vite.config.js에 base 경로 설정 (`base: '/app/'`)
- ✅ 모든 코드가 GitHub에 올라가 있음

## 📋 단계별 가이드 (5분 소요)

### 1단계: GitHub 저장소 접속

1. 브라우저에서 https://github.com/kimyunjung1227-arch/app 접속
2. 로그인 확인

### 2단계: Settings 페이지로 이동

1. 저장소 페이지 상단 메뉴에서 **"Settings"** 클릭
2. (로그인 안 되어 있으면 로그인 먼저 하기)

### 3단계: Pages 메뉴 찾기

1. 왼쪽 사이드바에서 스크롤 내리기
2. **"Pages"** 메뉴 찾기 (왼쪽 사이드바 아래쪽에 있음)
3. **"Pages"** 클릭

### 4단계: Source 설정

**"Build and deployment"** 섹션에서:

1. **"Source"** 드롭다운 메뉴 클릭
2. **"GitHub Actions"** 선택
   - (기본값으로 "Deploy from a branch"가 선택되어 있을 텐데, 이걸 "GitHub Actions"로 변경)

3. 설정이 자동으로 저장됨 (별도 저장 버튼 없음)

### 5단계: 배포 확인

#### 방법 1: Actions 탭에서 확인

1. 저장소 상단 메뉴에서 **"Actions"** 탭 클릭
2. **"Deploy to GitHub Pages"** 워크플로우가 실행되고 있는지 확인
3. 노란색 점(진행 중) 또는 초록색 체크(완료) 표시 확인

#### 방법 2: Pages 탭에서 확인

1. **"Settings"** > **"Pages"** 다시 들어가기
2. 배포가 완료되면 상단에 **"Visit site"** 버튼이 나타남
3. 또는 **"Your site is live at"** 메시지와 함께 URL 표시됨

### 6단계: 사이트 접속

배포가 완료되면 (1-2분 소요):

```
https://kimyunjung1227-arch.github.io/app/
```

이 URL로 접속하면 앱 화면을 볼 수 있습니다!

---

## 🔍 문제 해결

### 배포가 안 될 때

1. **Actions 탭 확인**
   - https://github.com/kimyunjung1227-arch/app/actions
   - 빨간색 X 표시가 있으면 클릭해서 에러 확인

2. **일반적인 에러들**
   - `npm install` 실패 → package.json 확인
   - `npm run build` 실패 → 빌드 에러 메시지 확인
   - 권한 문제 → Settings > Actions > General에서 권한 확인

3. **수동으로 워크플로우 실행**
   - Actions 탭으로 이동
   - "Deploy to GitHub Pages" 워크플로우 선택
   - 오른쪽 상단 **"Run workflow"** 버튼 클릭
   - **"Run workflow"** 다시 클릭

### Pages가 활성화되지 않을 때

- **Settings > Pages**에서 "Source"가 "GitHub Actions"로 설정되어 있는지 확인
- 저장소가 Public인지 확인 (Private 저장소는 유료 플랜 필요)

---

## 📱 공유하기

배포가 완료되면:

1. URL 복사: `https://kimyunjung1227-arch.github.io/app/`
2. 이 링크를 다른 사람들에게 공유
3. 링크를 클릭하면 바로 앱 화면을 볼 수 있음!

---

## 🔄 자동 업데이트

이제 코드를 업데이트하고 GitHub에 푸시하면:

```bash
git add .
git commit -m "Update code"
git push origin main
```

자동으로 다시 배포되어 웹사이트도 업데이트됩니다!

---

## ✅ 체크리스트

배포 전 확인:
- [ ] GitHub 저장소에 모든 코드가 올라가 있음
- [ ] `.github/workflows/deploy.yml` 파일이 있음
- [ ] `vite.config.js`에 `base: '/app/'` 설정이 있음

배포 후 확인:
- [ ] Settings > Pages에서 "GitHub Actions" 선택됨
- [ ] Actions 탭에서 워크플로우가 성공적으로 완료됨
- [ ] URL로 접속해서 앱이 정상 작동함

---

## 🎉 완료!

이제 다른 사람들에게 링크를 공유해서 의견을 구할 수 있습니다!

