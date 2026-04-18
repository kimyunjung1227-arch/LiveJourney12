import { defineConfig } from 'vite'
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
})
