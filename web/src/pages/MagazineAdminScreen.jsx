import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { loadMagazineTopics, saveMagazineTopics } from '../utils/magazinesConfig';

const emptyForm = {
  id: '',
  title: '',
  description: '',
  tagKeywords: '',
  emoji: '📚',
};

const MagazineAdminScreen = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setTopics(loadMagazineTopics());
  }, []);

  const handleSelect = (topic) => {
    setSelectedId(topic.id);
    setForm({
      id: topic.id,
      title: topic.title || '',
      description: topic.description || '',
      tagKeywords: (topic.tagKeywords || []).join(', '),
      emoji: topic.emoji || '📚',
    });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm({ ...emptyForm, emoji: '📚' });
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      alert('매거진 제목을 입력해 주세요.');
      return;
    }
    const id = form.id || `topic-${Date.now()}`;
    const tags = form.tagKeywords
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const next = [...topics];
    const idx = next.findIndex((t) => String(t.id) === String(id));
    const topic = {
      id,
      title: form.title.trim(),
      description: form.description.trim(),
      tagKeywords: tags,
      emoji: form.emoji || '📚',
    };
    if (idx >= 0) {
      next[idx] = topic;
    } else {
      next.unshift(topic);
    }
    setTopics(next);
    saveMagazineTopics(next);
    setSelectedId(id);
    setForm((prev) => ({ ...prev, id }));
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!window.confirm('이 매거진을 삭제할까요?')) return;
    const next = topics.filter((t) => String(t.id) !== String(selectedId));
    setTopics(next);
    saveMagazineTopics(next);
    handleNew();
    alert('삭제되었습니다.');
  };

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
            매거진 관리
          </h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-20">
          {/* 리스트 */}
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">테마 목록</h2>
              <button
                type="button"
                onClick={handleNew}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-black"
              >
                <span>새 매거진</span>
              </button>
            </div>
            {topics.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                아직 등록된 매거진이 없습니다. 오른쪽에서 새 매거진을 만들어 주세요.
              </p>
            ) : (
              <ul className="space-y-2">
                {topics.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(t)}
                      className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] ${
                        selectedId === t.id
                          ? 'border-primary bg-primary/5 text-gray-900'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100'
                      }`}
                    >
                      <span className="text-[18px]">{t.emoji || '📚'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{t.title}</p>
                        {t.description && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 편집 폼 */}
          <section className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
              매거진 편집
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  제목
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[13px]"
                  placeholder="예: 현재 만개한 수국을 볼 수 있는 장소"
                  value={form.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  설명
                </label>
                <textarea
                  className="w-full min-h-[64px] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[13px] resize-none"
                  placeholder="예: 지금 실제로 수국이 활짝 피어 있는 스팟만 모아 보여줘요."
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  태그 / 키워드 (쉼표로 구분)
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-[13px]"
                  placeholder="예: 수국, hydrangea"
                  value={form.tagKeywords}
                  onChange={(e) => handleChange('tagKeywords', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    아이콘 이모지
                  </label>
                  <input
                    className="w-16 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-[18px] text-center"
                    value={form.emoji}
                    onChange={(e) => handleChange('emoji', e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  메인 화면과 리스트에서 매거진을 대표하는 이모지입니다.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 rounded-full bg-primary text-white text-[13px] font-semibold py-2.5 hover:bg-primary-dark"
                >
                  저장
                </button>
                {selectedId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-24 rounded-full bg-gray-200 dark:bg-gray-800 text-[12px] text-gray-700 dark:text-gray-100 font-semibold py-2.5"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MagazineAdminScreen;

