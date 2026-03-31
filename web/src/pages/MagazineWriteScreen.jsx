import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { publishMagazine } from '../utils/magazinesStore';
import { useAuth } from '../contexts/AuthContext';
import { useAdminState } from '../utils/admin';

const MagazineWriteScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminState(user);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [saving, setSaving] = useState(false);
  const overview = subtitle;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!title.trim()) {
        alert('제목을 입력해 주세요.');
        return;
      }
      if (!overview.trim()) {
        alert('개요를 입력해 주세요.');
        return;
      }

      setSaving(true);
      const res = await publishMagazine({
        title: title.trim(),
        subtitle: overview.trim(),
        sections: [
          {
            location: title.trim(),
            description: overview.trim(),
            around: [],
          },
        ],
      });
      setSaving(false);

      if (!res.success) {
        alert('매거진 발행에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      navigate(`/magazine/${res.magazine.id}`, { replace: true, state: { magazine: res.magazine } });
    },
    [title, overview, navigate]
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
          {adminLoading ? (
            <div className="py-12 text-center text-[13px] text-gray-500">권한 확인 중...</div>
          ) : !isAdmin ? (
            <div className="py-12 text-center text-[13px] text-gray-500 dark:text-gray-400">
              <p className="mb-2 font-semibold text-gray-800 dark:text-gray-100">매거진 발행은 관리자 승인 계정만 가능합니다.</p>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center rounded-full bg-gray-900 text-white px-4 py-2 text-[13px] font-semibold"
              >
                돌아가기
              </button>
            </div>
          ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                제목
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[15px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: 갑자기 떠나고 싶을 때! 가볍게 다녀오는 국내 여행지"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                개요
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: 당일치기로 훌쩍 다녀오기 좋은 근교 여행지를 모았어요."
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
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
                발행한 매거진은 다른 기기에서도 보이도록 저장돼요.
              </p>
            </div>
          </form>
          )}
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MagazineWriteScreen;

