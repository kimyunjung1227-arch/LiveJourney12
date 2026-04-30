import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';

const ChatScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ask = location.state?.magazineAsk;

  const [message, setMessage] = useState('');

  useEffect(() => {
    if (ask?.presetMessage) {
      setMessage(String(ask.presetMessage));
    } else if (ask?.placeTitle) {
      setMessage('');
    }
  }, [ask?.placeTitle, ask?.presetMessage]);

  const suggested = Array.isArray(ask?.suggestedQuestions) && ask.suggestedQuestions.length > 0
    ? ask.suggestedQuestions
    : ['주차장 여유 있나요?', '지금 꽃 많이 피었나요?', '웨이팅/혼잡도 어떤가요?'];

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
    // 서버 운영 전환: localStorage 제거 (draft 저장 비활성화)
    alert('문의 내용이 접수되었습니다. 곧 채팅으로 연결될 예정이에요.');
    navigate('/main', { replace: true });
  };

  if (ask?.placeTitle || ask?.askQuery) {
    return (
      <div className="screen-layout bg-background-light dark:bg-background-dark">
        <div className="screen-content flex min-h-0 flex-col bg-white pb-20 dark:bg-gray-900" style={{ paddingBottom: 80 }}>
          <header className="screen-header shrink-0 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2 px-4 pb-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="뒤로"
              >
                <span className="material-symbols-outlined text-[22px] text-gray-700 dark:text-gray-200">
                  arrow_back
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="m-0 truncate text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                  상황 물어보기
                </h1>
                <p className="m-0 truncate text-xs font-medium text-primary">
                  {ask.locationInfoLine || ask.placeTitle || ask.askQuery}
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-4">
              <p className="mb-2 text-[12px] font-bold text-gray-700 dark:text-gray-200">
                가장 많이 묻는 실시간 질문
              </p>
              <div className="flex flex-wrap gap-2">
                {suggested.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setMessage(String(q))}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">메시지</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-[14px] text-gray-900 outline-none ring-primary/20 focus:ring-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="예: 웨이팅·주차·혼잡도를 알려 주세요."
            />
            <button
              type="button"
              onClick={handleSend}
              className="mt-4 w-full rounded-xl bg-primary py-3.5 text-[15px] font-bold text-white shadow-sm hover:opacity-95 active:opacity-90"
            >
              보내기
            </button>
          </main>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark">
      <div className="screen-content" style={{ background: '#ffffff', paddingBottom: 80 }}>
        <header className="screen-header border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">채팅</h1>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
            <span className="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500">chat</span>
          </div>
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">채팅 기능은 준비 중이에요</h2>
          <p className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            라이브 동행 채팅은 곧 업데이트될 예정입니다.
            <br />
            그동안은 메인 피드에서 여행 소식을 먼저 즐겨 주세요!
          </p>
          <button
            type="button"
            onClick={() => navigate('/main')}
            className="rounded-xl bg-[#00BCD4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00a8b8] active:opacity-90"
          >
            홈으로 가기
          </button>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default ChatScreen;
