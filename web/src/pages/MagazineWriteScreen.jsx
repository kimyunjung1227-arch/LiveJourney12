import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { publishMagazine } from '../utils/magazinesStore';
import { useAuth } from '../contexts/AuthContext';
import { useAdminState } from '../utils/admin';

const DRAFT_KEY = 'magazinePublishDraft';

const createEmptySection = (seed = {}) => ({
  id: `sec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  locationTitle: seed.locationTitle || '',
  locationInfo: seed.locationInfo || '',
  description: seed.description || '',
  aroundText: seed.aroundText || '',
});

const MagazineWriteScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminState(user);
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState([createEmptySection()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.title) setTitle(String(d.title));
      if (Array.isArray(d?.sections) && d.sections.length > 0) {
        setSections(
          d.sections.map((s) =>
            createEmptySection({
              locationTitle: s?.locationTitle,
              locationInfo: s?.locationInfo,
              description: s?.description,
              aroundText: s?.aroundText,
            })
          )
        );
      }
    } catch (_) {
      // ignore
    }
  }, []);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!Array.isArray(sections) || sections.length === 0) return false;
    return sections.some((s) => String(s?.locationTitle || '').trim() && String(s?.description || '').trim());
  }, [title, sections]);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, sections, savedAt: Date.now() }));
      alert('임시저장되었습니다.');
    } catch (_) {
      alert('임시저장에 실패했습니다.');
    }
  }, [title, sections]);

  const handleAddSection = useCallback(() => {
    setSections((prev) => {
      const last = prev && prev.length ? prev[prev.length - 1] : null;
      return [...(Array.isArray(prev) ? prev : []), createEmptySection(last || {})];
    });
  }, []);

  const handleChangeSection = useCallback((id, field, value) => {
    setSections((prev) => (Array.isArray(prev) ? prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)) : prev));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!title.trim()) {
        alert('제목을 입력해 주세요.');
        return;
      }
      const normalizedSections = (Array.isArray(sections) ? sections : [])
        .map((s) => ({
          locationTitle: String(s?.locationTitle || '').trim(),
          locationInfo: String(s?.locationInfo || '').trim(),
          description: String(s?.description || '').trim(),
          aroundText: String(s?.aroundText || '').trim(),
        }))
        .filter((s) => s.locationTitle || s.locationInfo || s.description || s.aroundText);
      if (normalizedSections.length === 0) {
        alert('최소 1개의 위치를 입력해 주세요.');
        return;
      }
      if (!normalizedSections.some((s) => s.locationTitle && s.description)) {
        alert('위치와 위치에 대한 설명은 최소 1개 이상 입력해 주세요.');
        return;
      }

      setSaving(true);
      const toAroundList = (text) =>
        String(text || '')
          .split(/[,/\\n]/)
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 12);
      const res = await publishMagazine({
        title: title.trim(),
        subtitle: '',
        sections: normalizedSections.map((s) => ({
          location: s.locationTitle || s.locationInfo || title.trim(),
          locationInfo: s.locationInfo,
          description: s.description,
          around: toAroundList(s.aroundText),
        })),
      });
      setSaving(false);

      if (!res.success) {
        alert('매거진 발행에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (_) {}
      navigate(`/magazine/${res.magazine.id}`, { replace: true, state: { magazine: res.magazine } });
    },
    [title, sections, navigate]
  );

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
        {/* 헤더 */}
        <header className="screen-header flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
          <button
            type="button"
            onClick={saveDraft}
            className="text-[14px] font-semibold text-gray-700 dark:text-gray-200 px-2 py-2"
          >
            임시저장
          </button>
          <button
            type="submit"
            form="magazine-publish-form"
            disabled={!canSubmit || saving}
            className={`text-[14px] font-extrabold px-2 py-2 ${
              !canSubmit || saving ? 'text-gray-300 dark:text-gray-600' : 'text-[#22c55e]'
            }`}
          >
            등록
          </button>
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
          <form id="magazine-publish-form" className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100">제목</label>
              <input
                className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-3 text-[16px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none"
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {sections.map((sec, idx) => (
              <section key={sec.id} className="pt-2">
                <div className="mb-2 text-[12px] font-extrabold text-gray-900 dark:text-gray-50">
                  위치 {idx + 1}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100">위치</label>
                    <input
                      className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-3 text-[15px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none"
                      placeholder="예: 경기 수원"
                      value={sec.locationTitle}
                      onChange={(e) => handleChangeSection(sec.id, 'locationTitle', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100">위치정보</label>
                    <input
                      className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-3 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none"
                      placeholder="예: 수원 화성 · 수원시 팔달구"
                      value={sec.locationInfo}
                      onChange={(e) => handleChangeSection(sec.id, 'locationInfo', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100">위치에 대한 설명</label>
                    <textarea
                      className="w-full min-h-[140px] bg-transparent px-0 py-2 text-[15px] leading-relaxed text-gray-900 dark:text-gray-50 focus:outline-none resize-none"
                      placeholder="설명글을 입력하세요."
                      value={sec.description}
                      onChange={(e) => handleChangeSection(sec.id, 'description', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100">위치 주변 가기 좋은 명소</label>
                    <textarea
                      className="w-full min-h-[84px] bg-transparent px-0 py-2 text-[14px] leading-relaxed text-gray-900 dark:text-gray-50 focus:outline-none resize-none"
                      placeholder="예: 방화수류정, 화성행궁, 장안문"
                      value={sec.aroundText}
                      onChange={(e) => handleChangeSection(sec.id, 'aroundText', e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      쉼표(,) 또는 줄바꿈으로 여러 개 입력할 수 있어요.
                    </p>
                  </div>
                </div>
              </section>
            ))}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddSection}
                className="w-full rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-gray-900/40 py-3 text-[14px] font-extrabold text-gray-900 dark:text-gray-50"
              >
                + 추가하기
              </button>
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

