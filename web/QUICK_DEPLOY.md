# ⚡ 빠른 배포 가이드 (5분 안에 공유 가능!)

다른 사람들에게 바로 공유할 수 있도록 빠르게 배포하는 방법입니다.

## 🚀 방법 1: Netlify (가장 빠름! 추천)

### 단계별 가이드 (약 3-5분)

#### 1단계: Netlify 접속 및 로그인

1. https://app.netlify.com 접속
2. **"Sign up"** 또는 **"Log in"** 클릭
3. **"Sign up with GitHub"** 선택 (GitHub 계정으로 로그인)
4. GitHub 인증 허용

#### 2단계: 저장소 연결

1. Netlify 대시보드에서 **"Add new site"** 버튼 클릭
2. **"Import an existing project"** 선택
3. **"GitHub"** 선택
4. GitHub 인증 허용 (처음인 경우)
5. 저장소 목록에서 **`app`** 또는 **`kimyunjung1227-arch/app`** 선택
6. **"Import"** 클릭

#### 3단계: 빌드 설정 (자동으로 채워짐!)

**설정이 자동으로 인식됩니다:**

- ✅ **Base directory**: (비워두기)
- ✅ **Build command**: `npm install && npm run build` (자동 입력됨)
- ✅ **Publish directory**: `dist` (자동 입력됨)

**확인 후:**

7. **"Deploy site"** 버튼 클릭

#### 4단계: 배포 완료!

- 1-2분 정도 기다리면 배포 완료
- 생성된 URL 확인 (예: `https://random-name-123.netlify.app`)
- 이 URL을 바로 공유하면 됩니다!

#### 5단계: 사이트 이름 변경 (선택사항, 더 예쁜 URL)

1. 사이트 대시보드에서 **"Site settings"** 클릭
2. **"Domain management"** 선택
3. **"Change site name"** 클릭
4. 원하는 이름 입력 (예: `livejourney-app`)
5. **"Save"** 클릭
6. 새로운 URL: `https://livejourney-app.netlify.app`

---

## 🎯 방법 2: Vercel (Netlify 대안)

### 단계별 가이드 (약 3-5분)

#### 1단계: Vercel 접속 및 로그인

1. https://vercel.com 접속
2. **"Sign Up"** 또는 **"Log In"** 클릭
3. **"Continue with GitHub"** 선택
4. GitHub 인증 허용

#### 2단계: 프로젝트 추가

1. 대시보드에서 **"Add New..."** > **"Project"** 클릭
2. 저장소 목록에서 **`app`** 선택
3. **"Import"** 클릭

#### 3단계: 빌드 설정

**자동으로 인식되지만 확인:**

- ✅ **Framework Preset**: Vite (자동 선택됨)
- ✅ **Root Directory**: `./` (기본값)
- ✅ **Build Command**: `npm run build` (자동)
- ✅ **Output Directory**: `dist` (자동)

**확인 후:**

4. **"Deploy"** 버튼 클릭

#### 4단계: 배포 완료!

- 1-2분 후 배포 완료
- 생성된 URL 확인 (예: `https://app-abc123.vercel.app`)
- 바로 공유 가능!

---

## ✅ 배포 후 확인 사항

1. ✅ 생성된 URL로 접속해서 앱이 정상 작동하는지 확인
2. ✅ 모든 페이지가 잘 작동하는지 확인
3. ✅ 모바일 화면에서도 잘 보이는지 확인

---

## 🔄 자동 배포 (배포 후)

이제 GitHub에 코드를 푸시하면 자동으로 다시 배포됩니다:

```bash
git add .
git commit -m "Update features"
git push origin main
```

Netlify/Vercel이 자동으로 새로운 버전을 배포합니다!

---

## 📱 공유 방법

배포가 완료되면:

1. **생성된 URL 복사** (예: `https://livejourney-app.netlify.app`)
2. **링크를 공유**:
   - 카카오톡, 슬랙, 이메일 등으로 공유
   - GitHub 저장소 README에 추가
   - 포트폴리오에 추가

---

## 🎉 완료!

이제 다른 사람들이 링크만 클릭하면 바로 앱을 확인할 수 있습니다!

