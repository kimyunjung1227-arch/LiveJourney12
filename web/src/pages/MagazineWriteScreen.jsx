import React, { useCallback, useMemo, useState } from 'react';
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
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [around1, setAround1] = useState('');
  const [around2, setAround2] = useState('');
  const [around3, setAround3] = useState('');
  const [saving, setSaving] = useState(false);

  const aroundList = useMemo(() => {
    return [around1, around2, around3].map((v) => String(v || '').trim()).filter(Boolean);
  }, [around1, around2, around3]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!title.trim()) {
        alert('제목을 입력해 주세요.');
        return;
      }
      if (!subtitle.trim()) {
        alert('소제목을 입력해 주세요.');
        return;
      }
      if (!locationName.trim()) {
        alert('위치정보를 입력해 주세요.');
        return;
      }
      if (!locationDescription.trim()) {
        alert('위치설명을 입력해 주세요.');
        return;
      }

      setSaving(true);
      const res = await publishMagazine({
        title: title.trim(),
        subtitle: subtitle.trim(),
        sections: [
          {
            location: locationName.trim(),
            description: locationDescription.trim(),
            around: aroundList,
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
    [title, subtitle, locationName, locationDescription, aroundList, navigate]
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
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: 지금 벚꽃이 만개한 장소 TOP 7"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                소제목
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: 한산적으로 만개한 벚꽃 명소들을 한눈에 알아봐요."
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                위치정보
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[13px] text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="예: 김천 연화지"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                사진은 이 위치에서 올라온 게시물을 자동으로 모아서 보여줘요. (사진 입력은 최소화)
              </p>
            </div>

            <div>
              <label className="block mb-2 text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                위치설명
              </label>
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-gray-50 leading-relaxed resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder={'예시)\n지금 벚꽃이 예쁘게 피어 있어요. 산책하기 좋은 동선이에요.'}
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                주변 명소, 맛집 (최대 3개)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[13px]"
                  placeholder="예: 성당못"
                  value={around1}
                  onChange={(e) => setAround1(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[13px]"
                  placeholder="예: 카페"
                  value={around2}
                  onChange={(e) => setAround2(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[13px]"
                  placeholder="예: 맛집"
                  value={around3}
                  onChange={(e) => setAround3(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                여기에 입력한 키워드로 주변 장소 썸네일을 자동으로 찾아 보여줘요.
              </p>
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

