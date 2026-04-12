import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRecommendationTypesForUi,
  saveRecommendedFilterUi,
  resetRecommendedFilterUi,
} from '../utils/recommendationEngine';

const AdminRecommendedFiltersScreen = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState(() => getRecommendationTypesForUi());
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const sync = () => setRows(getRecommendationTypesForUi());
    window.addEventListener('recommendedFilterUiUpdated', sync);
    return () => window.removeEventListener('recommendedFilterUiUpdated', sync);
  }, []);

  const persist = useCallback((next) => {
    setRows(next);
    saveRecommendedFilterUi(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }, []);

  const updateRow = (id, patch) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    persist(next);
  };

  const move = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const copy = [...rows];
    const [a] = copy.splice(index, 1);
    copy.splice(j, 0, a);
    const reordered = copy.map((r, i) => ({ ...r, order: i }));
    persist(reordered);
  };

  const handleReset = () => {
    if (!window.confirm('필터 표시 설정을 기본값으로 되돌릴까요?')) return;
    resetRecommendedFilterUi();
    setRows(getRecommendationTypesForUi());
  };

  return (
    <div className="screen-layout bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="뒤로가기"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">꼭 가야 할 곳 필터</h1>
        <div className="w-10" />
      </header>

      <main className="p-4 pb-24 max-w-lg mx-auto w-full">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
          메인 화면「지금, 이 순간 꼭 가야 할 곳」상단의 필터 칩 이름·이모지·순서·노출을 설정합니다.
          추천 알고리즘에 쓰이는 내부 ID(시즌/핫플 등)는 바뀌지 않고, 표시만 바뀝니다.
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-3 py-2 mb-4">
          카드 아래 회색 태그는 각 장소 게시물에 입력된 태그(업로드 시)를 모아 보여 줍니다. 태그가 없을 때만
          자동 생성 태그를 씁니다.
        </p>

        {savedFlash && (
          <div className="mb-3 text-xs font-semibold text-teal-700 dark:text-teal-300">저장했습니다.</div>
        )}

        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-mono text-gray-400 truncate">{row.id}</span>
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 shrink-0">
                  <input
                    type="checkbox"
                    checked={row.enabled !== false}
                    onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
                  />
                  노출
                </label>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={row.icon || ''}
                  onChange={(e) => updateRow(row.id, { icon: e.target.value })}
                  className="w-14 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-center text-lg py-2"
                  maxLength={8}
                  aria-label="아이콘"
                />
                <input
                  type="text"
                  value={row.name || ''}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="필터 이름"
                />
              </div>
              <textarea
                value={row.description || ''}
                onChange={(e) => updateRow(row.id, { description: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 mb-3"
                placeholder="설명(선택)"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="flex-1 rounded-full bg-gray-100 dark:bg-gray-700 py-2 text-xs font-semibold text-gray-700 dark:text-gray-100 disabled:opacity-40"
                >
                  위로
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  className="flex-1 rounded-full bg-gray-100 dark:bg-gray-700 py-2 text-xs font-semibold text-gray-700 dark:text-gray-100 disabled:opacity-40"
                >
                  아래로
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleReset}
          className="mt-6 w-full rounded-full border border-gray-300 dark:border-gray-600 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200"
        >
          기본값으로 초기화
        </button>
      </main>
    </div>
  );
};

export default AdminRecommendedFiltersScreen;
