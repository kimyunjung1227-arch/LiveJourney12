/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Live Blue (메인 키 컬러) — 조금 더 연한 톤으로 조정
        "primary": "#26C6DA",           // Live Blue - 활성 탭, CTA, 링크 (기존 #00BCD4 보다 살짝 연한 톤)
        "primary-dark": "#00BCD4",      // Hover/Active (이전 메인 컬러를 다크 톤으로 사용)
        "primary-soft": "#E0F7FA",      // 기존 소프트 블루 유지
        "primary-5": "rgba(38, 198, 218, 0.05)",   // 배경용 5% 톤
        "primary-10": "rgba(38, 198, 218, 0.1)",   // 호버 등 아주 연한 강조

        // Journey Yellow (보조/CTA 컬러)
        "accent": "#FFC107",            // Journey Yellow - 즐거움, 설렘, CTA
        "accent-dark": "#FFA000",
        "accent-soft": "#FFF8E1",

        // 다양한 보조 컬러 팔레트
        "secondary-1": "#9C27B0",      // Purple - 특별함, 프리미엄
        "secondary-1-dark": "#7B1FA2",
        "secondary-1-soft": "#F3E5F5",
        
        "secondary-2": "#4CAF50",       // Green - 자연, 성장, 성공
        "secondary-2-dark": "#388E3C",
        "secondary-2-soft": "#E8F5E9",
        
        "secondary-3": "#E91E63",       // Pink - 따뜻함, 하이라이트
        "secondary-3-dark": "#C2185B",
        "secondary-3-soft": "#FCE4EC",
        
        "secondary-4": "#FF5722",       // Deep Orange - 에너지, 활기
        "secondary-4-dark": "#E64A19",
        "secondary-4-soft": "#FBE9E7",
        
        "secondary-5": "#00ACC1",       // Cyan - 신선함, 명확함
        "secondary-5-dark": "#00838F",
        "secondary-5-soft": "#E0F7FA",
        
        "secondary-6": "#5C6BC0",       // Indigo - 깊이, 신뢰
        "secondary-6-dark": "#3F51B5",
        "secondary-6-soft": "#E8EAF6",
        
        "secondary-7": "#26A69A",       // Teal - 균형, 조화
        "secondary-7-dark": "#00695C",
        "secondary-7-soft": "#E0F2F1",

        // 기본 톤 (기존 구조 유지, 톤만 살짝 중립적으로 조정)
        "background-light": "#ffffff",
        "background-dark": "#0B1020",
        "text-light": "#111827",
        "text-dark": "#F9FAFB",
        "text-primary-light": "#111827",
        "text-secondary-light": "#6B7280",
        "text-primary-dark": "#F9FAFB",
        "text-secondary-dark": "#9CA3AF",
        "text-subtle-light": "#9CA3AF",
        "text-subtle-dark": "#6B7280",
        "card-light": "#ffffff",
        "card-dark": "#111827",
        "border-light": "#E5E7EB",
        "border-dark": "#1F2937",
        "surface": "#ffffff",
        "text-headings": "#111827",
        "text-body": "#4B5563",
        "subtle-light": "#E0F2FE",
        "subtle-dark": "#0F172A",
        "placeholder-light": "#9CA3AF",
        "placeholder-dark": "#6B7280",
      },
      fontFamily: {
        "display": ["Plus Jakarta Sans", "Noto Sans KR", "sans-serif"],
        "manrope": ["Manrope", "Noto Sans KR", "sans-serif"],
        "inter": ["Inter", "Noto Sans KR", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "1rem",
        "lg": "2rem",
        "xl": "3rem",
        "full": "9999px"
      },
    },
  },
  plugins: [],
}

