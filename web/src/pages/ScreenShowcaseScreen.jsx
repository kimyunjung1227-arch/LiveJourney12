import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * 화면 쇼케이스 (전체 흐름 한눈에 보기)
 * --------------------------------------------------
 * 라이브저니 웹의 모든 주요 화면을 실제 라우트 그대로 폰 목업(iframe) 안에
 * 띄워, 한 페이지에서 전체 사용자 흐름을 훑어볼 수 있게 한다.
 *
 * - 각 카드 = 실제 화면을 그대로 렌더한 라이브 미리보기 (iframe)
 * - iframe 은 크래시/오류가 격리되므로 파라미터·인증이 필요한 화면도 안전
 * - IntersectionObserver 로 화면에 들어올 때만 로드 (초기 부하 최소화)
 * - SCREENS.md 의 20개 화면 + 진입/부가 화면을 흐름 순서대로 묶음
 *
 * 접근: /showcase
 */

// ── 디자인 토큰 ──────────────────────────────────────
const KEY = '#4DB8E8'
const KEY_DARK = '#1A6EA8'
const KEY_SOFT = '#E8F4FB'
const GRAY = '#6B6B6B'

// 폰 목업 기준 해상도 (iPhone 14 Pro 급)
const DEVICE_W = 390
const DEVICE_H = 844

// ── 화면 정의 ────────────────────────────────────────
// param/protected 화면은 note 로 표시. 샘플 파라미터는 화면이 자체적으로
// 빈 상태/리다이렉트를 처리하므로 흐름 파악에는 충분하다.
const GROUPS = [
  {
    id: 'entry',
    title: '진입 · 온보딩',
    desc: '앱 첫 방문 → 둘러보기 / 가입 유도',
    screens: [
      { n: '—', name: '웰컴', route: '/welcome', desc: '첫 진입 랜딩' },
      { n: '—', name: '온보딩', route: '/onboarding', desc: '핵심 가치 소개' },
      { n: '—', name: '시작', route: '/start', desc: '로그인 / 가입' },
    ],
  },
  {
    id: 'tabs',
    title: '메인 5개 탭',
    desc: '하단 탭으로 오가는 앱의 척추',
    screens: [
      { n: 1, name: '홈', route: '/main', desc: '실시간 피드 · 베스트 컷 카드' },
      { n: 2, name: '핫플', route: '/hotplace', desc: '최근 6시간 활동 랭킹' },
      { n: 3, name: '카메라', route: '/camera', desc: 'EXIF 인증 직접 촬영' },
      { n: 4, name: '지도', route: '/map', desc: '핀 · 지역 검색 · 장소 카드' },
      { n: 5, name: '프로필', route: '/profile', desc: '내 활동 · 베스트 컷 작가' },
    ],
  },
  {
    id: 'create',
    title: '콘텐츠 생성 흐름',
    desc: '카메라 → 정보 입력 → 업로드 완료',
    screens: [
      { n: 9, name: '정보 입력', route: '/upload', desc: '카테고리 · 한 줄 설명', note: '카메라 다음 단계' },
      { n: 10, name: '업로드 완료', route: '/upload/complete/sample', desc: '자동 매칭 · 실시간 조회', note: '샘플 ID' },
    ],
  },
  {
    id: 'explore',
    title: '탐색 · 콘텐츠 흐름',
    desc: '검색을 허브로 한 깊은 탐색',
    screens: [
      { n: 6, name: '검색', route: '/search', desc: '도시 · 카테고리 · 핫플 미리보기' },
      { n: 7, name: '카테고리', route: '/category/cherry-blossom', desc: '카테고리별 사진 그리드', note: '샘플 카테고리' },
      { n: 8, name: '알림', route: '/notifications', desc: '영향력 · 베스트 컷 영예' },
      { n: 12, name: '도시 페이지', route: '/city/서울', desc: '도시 단위 라이브 피드', note: '샘플 도시' },
      { n: 13, name: '장소 페이지', route: '/place/sample', desc: '베스트 컷 히어로 ⭐', note: '샘플 장소' },
      { n: 11, name: '풀스크린', route: '/photo/sample', desc: '사진 단일 뷰', note: '샘플 사진' },
    ],
  },
  {
    id: 'social',
    title: '질문 · 사람',
    desc: '실시간 질문과 베스트 컷 작가',
    screens: [
      { n: 15, name: '실시간 질문', route: '/questions', desc: '현장 매칭 질문 리스트' },
      { n: 16, name: '답변 작성', route: '/question/sample', desc: '현장 사진으로 답변', note: '샘플 질문' },
      { n: 17, name: '다른 사용자', route: '/user/sample', desc: '베스트 컷 캐러셀 · 팔로우', note: '샘플 유저' },
      { n: 14, name: '시즌 캘린더', route: '/season', desc: '작년 데이터로 올해 계획' },
    ],
  },
  {
    id: 'magazine',
    title: '매거진 · 큐레이션',
    desc: '에디터가 엮은 라이브 매거진',
    screens: [
      { n: '+', name: '매거진 목록', route: '/magazine', desc: '큐레이션 매거진' },
      { n: '+', name: '매거진 모음', route: '/magazines', desc: '컬렉션 보기' },
    ],
  },
  {
    id: 'settings',
    title: '설정 · 계정',
    desc: '프로필/알림/약관 (일부 로그인 필요)',
    screens: [
      { n: 18, name: '설정', route: '/settings', desc: '계정 · 알림 · 개인정보', note: '로그인 필요' },
      { n: '+', name: '뱃지', route: '/profile/badges', desc: '획득 뱃지 모음' },
      { n: '+', name: '공지', route: '/notices', desc: '공지사항' },
      { n: '+', name: 'FAQ', route: '/faq', desc: '자주 묻는 질문' },
    ],
  },
]

// base 경로 (dev: '/', prod: BASE_URL) 를 존중해 iframe src 생성
function buildSrc(route) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return base + route
}

// ── 폰 목업 카드 ─────────────────────────────────────
function ScreenCard({ screen, scale, autoLoad }) {
  const [load, setLoad] = useState(autoLoad)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef(null)

  // 화면에 들어오면 자동 로드
  useEffect(() => {
    if (load || autoLoad) {
      if (autoLoad) setLoad(true)
      return
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoad(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [load, autoLoad])

  const frameW = Math.round(DEVICE_W * scale)
  const frameH = Math.round(DEVICE_H * scale)

  return (
    <div style={{ width: frameW, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 폰 베젤 */}
      <div
        ref={ref}
        style={{
          width: frameW,
          height: frameH,
          borderRadius: 22,
          border: '6px solid #1b1b1f',
          background: '#fff',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 8px 24px rgba(20,40,60,0.12)',
          flex: '0 0 auto',
        }}
      >
        {/* 노치 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: frameW * 0.32,
            height: 14,
            background: '#1b1b1f',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            zIndex: 3,
          }}
        />
        {load ? (
          <>
            {!loaded && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: KEY_SOFT,
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    border: `3px solid ${KEY}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'lj-spin 0.8s linear infinite',
                  }}
                />
              </div>
            )}
            <iframe
              title={screen.name}
              src={buildSrc(screen.route)}
              onLoad={() => setLoaded(true)}
              loading="lazy"
              style={{
                width: DEVICE_W,
                height: DEVICE_H,
                border: 'none',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                background: '#fff',
              }}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setLoad(true)}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: KEY_SOFT,
              border: 'none',
              cursor: 'pointer',
              color: KEY_DARK,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 22 }}>＋</span>
            미리보기 불러오기
          </button>
        )}
      </div>

      {/* 라벨 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: typeof screen.n === 'number' ? KEY : '#d7e7f0',
            color: typeof screen.n === 'number' ? '#fff' : KEY_DARK,
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {screen.n}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1f1f1f' }}>{screen.name}</span>
        <a
          href={buildSrc(screen.route)}
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: 'auto', fontSize: 10, color: KEY, textDecoration: 'none', fontWeight: 600 }}
        >
          새 탭 ↗
        </a>
      </div>
      <div style={{ fontSize: 11, color: GRAY, lineHeight: 1.4 }}>{screen.desc}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <code style={{ fontSize: 10, color: '#8a8a8a', background: '#f3f5f7', padding: '1px 5px', borderRadius: 4 }}>
          {screen.route}
        </code>
        {screen.note && (
          <span style={{ fontSize: 9, color: '#b06a00', background: '#fff3e0', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
            {screen.note}
          </span>
        )}
      </div>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────
export default function ScreenShowcaseScreen() {
  const [scale, setScale] = useState(0.46)
  const [autoLoad, setAutoLoad] = useState(false)

  const total = useMemo(() => GROUPS.reduce((s, g) => s + g.screens.length, 0), [])

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fa', paddingBottom: 80 }}>
      <style>{`
        @keyframes lj-spin { to { transform: rotate(360deg); } }
        .lj-showcase-grid { display: flex; flex-wrap: wrap; gap: 28px 20px; }
      `}</style>

      {/* 헤더 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e6ebef',
          padding: '14px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: KEY_DARK }}>
              라이브저니 화면 쇼케이스
            </span>
            <span style={{ fontSize: 11, color: GRAY }}>
              전체 흐름 한눈에 보기 · 총 {total}개 화면 (실시간 미리보기)
            </span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#444' }}>
              크기
              <input
                type="range"
                min={0.34}
                max={0.62}
                step={0.02}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#444', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoLoad} onChange={(e) => setAutoLoad(e.target.checked)} />
              모두 즉시 로드
            </label>
          </div>
        </div>
      </header>

      {/* 그룹별 화면 */}
      <main style={{ padding: '24px 20px', maxWidth: 1500, margin: '0 auto' }}>
        {GROUPS.map((group, gi) => (
          <section key={group.id} style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: KEY,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {gi + 1}
              </span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1f1f1f', margin: 0 }}>{group.title}</h2>
              <span style={{ fontSize: 12, color: GRAY }}>{group.desc}</span>
            </div>
            <div
              style={{
                height: 2,
                background: `linear-gradient(90deg, ${KEY}, transparent)`,
                borderRadius: 2,
                marginBottom: 20,
              }}
            />
            <div className="lj-showcase-grid">
              {group.screens.map((screen) => (
                <ScreenCard key={screen.route} screen={screen} scale={scale} autoLoad={autoLoad} />
              ))}
            </div>
          </section>
        ))}

        <footer style={{ textAlign: 'center', color: '#9aa4ab', fontSize: 11, marginTop: 12 }}>
          실제 라우트를 그대로 띄운 라이브 미리보기입니다 · 화면을 탭하면 새 탭에서 전체 크기로 열 수 있어요
        </footer>
      </main>
    </div>
  )
}
