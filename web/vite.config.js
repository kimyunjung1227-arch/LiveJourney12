import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드 시점에 Vercel/로컬 환경변수 사용 (loadEnv 제거로 배포 빌드 안정화)
const kakaoKey = typeof process !== 'undefined' && process.env && process.env.VITE_KAKAO_MAP_API_KEY
  ? String(process.env.VITE_KAKAO_MAP_API_KEY).trim()
  : ''

/** OG·canonical·JSON-LD용 공개 베이스 URL(trailing slash 없음). 서브경로 배포 시 전체 베이스까지 포함해 설정 */
function getPublicBaseForHtml() {
  const raw = typeof process !== 'undefined' && process.env && process.env.VITE_SITE_URL
    ? String(process.env.VITE_SITE_URL).trim()
    : ''
  return (raw || 'https://livejourney.co.kr').replace(/\/$/, '')
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'inject-kakao-script',
      transformIndexHtml(html) {
        const publicBase = getPublicBaseForHtml()
        let out = html.replace(/__PUBLIC_BASE__/g, publicBase)
        try {
          const scriptTag = kakaoKey
            ? `<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoKey)}&libraries=services,clusterer&autoload=false" defer></script>`
            : ''
          out = out.replace('<!-- KAKAO_MAP_SCRIPT -->', scriptTag)
        } catch (_) {
          out = out.replace('<!-- KAKAO_MAP_SCRIPT -->', '')
        }
        return out
      },
    },
  ],
  publicDir: 'public',
  // GitHub Pages: 서브경로 배포 시 필수 (CI에서 VITE_BASE_URL 주입). 로컬/Vercel은 기본 '/'
  base: process.env.VITE_BASE_URL || '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'swiper', 'leaflet', 'react-leaflet'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    reportCompressedSize: false,
    // 프로덕션은 esbuild 압축 권장 (CI는 Node 20으로 빌드)
    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      maxParallelFileOps: 2,
    },
  },
})

