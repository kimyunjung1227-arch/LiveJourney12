import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const UploadGuideScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location?.state?.returnTo || '/upload';

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
      <header className="screen-header sticky top-0 z-[100] flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-white px-4 py-2.5 dark:border-border-dark dark:bg-gray-900">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex size-12 shrink-0 items-center justify-center text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="뒤로가기"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <div className="flex-1 text-center text-base font-bold text-text-primary-light dark:text-text-primary-dark">
          업로드 가이드
        </div>
        <div className="w-12" aria-hidden />
      </header>

      <main className="screen-content flex-1 overflow-auto px-4 pb-24 pt-4 bg-background-light dark:bg-background-dark">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="px-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  📸 라이브저니(LiveJourney) 업로드 가이드
                </p>
                <h1 className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
                  당신의 지금 이 순간이 누군가의 여행을 완벽하게 만듭니다.
                </h1>
              </div>
              <div className="shrink-0 text-primary text-xs font-bold">
                Live
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
              라이브저니는 화려하게 보정된 사진보다, <span className="font-bold">‘지금 바로 그곳의 모습’</span>을 소중하게 생각합니다.
              다른 여행자들이 실패 없는 여행을 할 수 있도록 아래 가이드를 확인해 주세요!
            </p>

            <div className="mt-5 space-y-3">
              <section className="px-1 py-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    1. ‘지금’의 진실을 담아주세요 <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">(Real-time)</span>
                  </h2>
                </div>
                <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                  <li>
                    <span className="font-semibold">촬영 시점</span>: 갤러리에 오래 묵혀둔 사진보다는, 지금 현장에서 찍은 사진이나 영상이 가장 가치 있습니다.
                  </li>
                  <li>
                    <span className="font-semibold">시차 없는 정보</span>: 지금 꽃이 얼마나 폈는지, 웨이팅 줄이 얼마나 긴지, 날씨는 어떤지 ‘현재 상황’을 그대로 보여주세요.
                  </li>
                </ul>
              </section>

              <section className="px-1 py-2">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  2. 필터는 빼고, 생생함은 더하고 <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">(No Filter, Just Truth)</span>
                </h2>
                <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                  <li>
                    <span className="font-semibold">보정 자제</span>: 과도한 필터는 현장의 색감을 왜곡할 수 있습니다. 다음 여행자가 가서 실망하지 않도록, 눈에 보이는 그대로의 모습을 공유해 주세요.
                  </li>
                  <li>
                    <span className="font-semibold">솔직한 시선</span>: 예쁜 각도만 찾기보다, 사람이 붐비는 정도나 공사 중인 구역 등 <span className="font-bold">‘진짜 정보’</span>가 될 만한 부분을 함께 찍어주시면 더욱 좋습니다.
                  </li>
                </ul>
              </section>

              <section className="px-1 py-2">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  3. 실패를 줄여주는 ‘한 줄 꿀팁’ <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">(Value-added Info)</span>
                </h2>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                  단순히 “좋아요”라는 말보다, 다른 여행자의 발걸음을 가치 있게 만드는 정보를 덧붙여주세요.
                </p>
                <p className="mt-3 text-[12px] font-semibold text-gray-900 dark:text-white">예시</p>
                <ul className="mt-1 space-y-1 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">
                  <li>“지금 줄 10미터 정도 있어요. 15분 기다렸습니다!”</li>
                  <li>“블로그엔 만개라고 했는데 아직 50%만 폈어요. 내일 오시는 게 좋을 듯!”</li>
                </ul>
              </section>

              <section className="px-1 py-2">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  4. 현명하고 즐거운 여행자의 매너 <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">(Pleasant Manners)</span>
                </h2>
                <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                  <li>
                    <span className="font-semibold">타인의 사생활 보호</span>: 사진 촬영 시 다른 여행자들의 얼굴이 너무 노출되지 않도록 배려해 주세요.
                  </li>
                  <li>
                    <span className="font-semibold">따뜻한 연결</span>: 내 글에 달리는 “지금 거기 어떤가요?”라는 질문에 실시간으로 답해주시면, 라이브저니 커뮤니티는 더욱 끈끈해집니다.
                  </li>
                </ul>
              </section>
            </div>

            <div className="mt-6 px-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    // 서버 운영 전환: sessionStorage 제거
                  } catch (_) {}
                  navigate(returnTo, { replace: true, state: { fromUploadGuide: true } });
                }}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
              >
                가이드 확인하고 업로드하기
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                나중에 할게요
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UploadGuideScreen;

