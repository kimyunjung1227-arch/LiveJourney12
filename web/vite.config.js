import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const kakaoKey = typeof process !== 'undefined' && process.env && process.env.VITE_KAKAO_MAP_API_KEY
  ? String(process.env.VITE_KAKAO_MAP_API_KEY).trim()
  : ''

function getPublicBaseForHtml() {
  const raw = typeof process !== 'undefined' && process.env && process.env.VITE_SITE_URL
    ? String(process.env.VITE_SITE_URL).trim()
    : ''
  return (raw || 'https://livejourney.co.kr').replace(/\/$/, '')
}

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:5000'

/**
 * Vite는 기본적으로 VITE_ 로 시작하는 변수만 번들에 넣는다.
 * Cloudflare 등에 SUPABASE_URL / SUPABASE_ANON_KEY 만 있고 VITE_ 접두사가 없으면
 * 클라이언트에서 undefined 가 되어 날씨·Supabase 클라이언트가 동작하지 않는다.
 * 빌드 시 VITE_* 또는 SUPABASE_* 중 있는 값을 합친다(service_role 등은 여기 넣지 말 것).
 */
function resolveSupabaseEnvForClient(mode) {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim()
  const anon = String(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim()
  return { url, anon }
}

export default defineConfig(({ mode }) => {
  const { url: supabaseUrl, anon: supabaseAnon } = resolveSupabaseEnvForClient(mode)

  return {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnon),
  },
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
  // 서브경로 배포 시 반드시 VITE_BASE_URL=/subdir/ 로 빌드. nginx 등에서 /assets/* 를 index.html 로 폴백하면 MIME 모듈 오류가 난다.
  base: process.env.VITE_BASE_URL || '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/api': { target: devProxyTarget, changeOrigin: true },
      '/uploads': { target: devProxyTarget, changeOrigin: true },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'swiper', 'leaflet', 'react-leaflet'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    reportCompressedSize: false,
    minify: 'terser',
    cssMinify: false,
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      maxParallelFileOps: 2,
    },
  },
  }
})
