## Windows 빌드(중요)

현재 이 프로젝트는 `web/package.json`의 engines 기준으로 **Node 20~22**에서 빌드되는 것을 전제로 합니다.
Windows에서 **Node 24**로 `vite build`를 실행하면 `3221226505`(프로세스 크래시)로 종료되는 사례가 있어,
로컬 빌드는 **Node 22**로 맞춰서 진행하세요.

### 권장: Volta 사용

- Volta 설치 후, `web` 폴더에서 자동으로 Node 22를 사용합니다. (`package.json`의 `volta` 필드)

### 대안: nvm-windows / fnm 사용

- Node 22 설치 후 아래처럼 맞춘 뒤 빌드:

```bash
cd web
npm ci
npm run build
```

### 확인

```bash
cd web
node -v
npm run build
```

