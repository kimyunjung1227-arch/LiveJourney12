import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'magazines';

const saveMagazine = (magazine) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    const updated = [magazine, ...arr];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    logger.warn('매거진 저장 실패:', e);
    return false;
  }
};

const MagazineWriteScreen = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [regionName, setRegionName] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!title.trim()) {
        alert('제목을 입력해 주세요.');
        return;
      }
      if (!body.trim()) {
        alert('본문 내용을 입력해 주세요.');
        return;
      }

      const now = new Date().toISOString();
      const magazine = {
        id: `mag-${Date.now()}`,
        title: title.trim(),
        summary: summary.trim() || null,
        regionName: regionName.trim() || null,
        coverImage: coverImageUrl.trim() || null,
        createdAt: now,
        updatedAt: now,
        author: '나의 기록',
        content: [
          {
            type: 'text',
            title: null,
            body: body,
          },
        ],
      };

      setSaving(true);
      const ok = saveMagazine(magazine);
      setSaving(false);

      if (!ok) {
        alert('매거진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      navigate(`/magazine/${magazine.id}`, { replace: true, state: { magazine } });
    },
    [title, summary, regionName, coverImageUrl, body, navigate]
  );

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
        {/* 헤더 */}
        <header className="screen-header flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h1 className="text-[18px] font-bold text-text-primary-light dark:text-text-primary-dark m-0">
            매거진 쓰기
          </h1>
          <div className="w-10" />
        </header>

        {/* 폼 */}
        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-20">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                제목
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: 하루 만에 둘러보는 부산 바다 동선"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                한 줄 요약 (선택)
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: 해운대–광안리–송정까지, 놓치면 아쉬운 스팟만 모았어요."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                  지역 (선택)
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                  placeholder="예: 부산, 제주, 서울 종로"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                커버 이미지 URL (선택)
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[13px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: https://images.unsplash.com/..."
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                아직은 URL로만 등록 가능해요. 나중에 업로드한 사진을 바로 선택할 수 있도록 확장할 예정입니다.
              </p>
            </div>

            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                본문
              </label>
              <textarea
                className="w-full min-h-[220px] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 leading-relaxed resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder={'예시)\n1. 아침 – 광안리 해변 산책\n2. 점심 – 현지인 추천 맛집\n3. 오후 – 감성 카페 & 포토 스팟\n\n하루 동선과 시간대별 팁을 자유롭게 적어주세요.'}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="pt-2 pb-4">
              <button
                type="submit"
                disabled={saving}
                className={`w-full rounded-full min-h-[46px] text-[14px] font-semibold text-white ${
                  saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'
                } transition-colors`}
              >
                {saving ? '저장 중...' : '매거진 발행하기'}
              </button>
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 text-center">
                지금은 내 기기에서만 보이는 개인 매거진으로 저장돼요.
              </p>
            </div>
          </form>
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MagazineWriteScreen;

