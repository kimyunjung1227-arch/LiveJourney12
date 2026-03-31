import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { publishMagazine } from '../utils/magazinesStore';
import { useAuth } from '../contexts/AuthContext';
import { useAdminState } from '../utils/admin';

const DRAFT_KEY = 'magazinePublishDraft';

const extractBetween = (text, startRe, endRe) => {
  const s = text.search(startRe);
  if (s < 0) return '';
  const after = text.slice(s).replace(startRe, '');
  if (!endRe) return after.trim();
  const e = after.search(endRe);
  return (e < 0 ? after : after.slice(0, e)).trim();
};

const parseMagazinePaste = (raw) => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim());
  const titleLine = lines.find((l) => l && !/^\d+\./.test(l)) || '';

  const blocks = [];
  const re = /(^|\n)(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n\d+\.\s|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = String(m[3] || '').trim();
    const body = String(m[4] || '');
    const locationInfo = (() => {
      const mm = body.match(/위치정보\s*:\s*([^\n]+)/);
      return mm ? String(mm[1]).trim() : '';
    })();
    const description = extractBetween(body, /위치 설명\s*:\s*/i, /\n\s*위치 주변|\n\s*사진\s*:|$/i);
    const aroundText = extractBetween(body, /위치 주변[^:]*:\s*/i, /$/i);
    const boldNames = [];
    const bRe = /\*\*\s*'?(.*?)'?\s*\*\*/g;
    let bm;
    while ((bm = bRe.exec(aroundText)) !== null) {
      const n = String(bm[1] || '').trim();
      if (n && !boldNames.includes(n)) boldNames.push(n);
    }
    const aroundPlaces = boldNames.slice(0, 8).map((n, i) => ({ id: `ap-${Date.now()}-${i}`, info: n, desc: '' }));

    blocks.push({
      locationTitle: name.replace(/^['"]|['"]$/g, '').trim(),
      locationInfo,
      description,
      aroundPlaces,
    });
  }

  if (!blocks.length) return null;
  return { title: titleLine, sections: blocks };
};

const createEmptySection = (seed = {}) => ({
  id: `sec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  locationTitle: seed.locationTitle || '',
  locationInfo: seed.locationInfo || '',
  description: seed.description || '',
  aroundPlaces: Array.isArray(seed.aroundPlaces) && seed.aroundPlaces.length
    ? seed.aroundPlaces
    : [
        { id: `ap-${Date.now()}-1`, info: '', desc: '' },
        { id: `ap-${Date.now()}-2`, info: '', desc: '' },
        { id: `ap-${Date.now()}-3`, info: '', desc: '' },
      ],
});

const MagazineWriteScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminState(user);
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState([createEmptySection()]);
  const [pasteText, setPasteText] = useState('');
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
              aroundPlaces: s?.aroundPlaces,
            })
          )
        );
      }
    } catch (_) {
      // ignore
    }
  }, []);

  const applyPaste = useCallback((raw) => {
    const parsed = parseMagazinePaste(raw);
    if (!parsed) return false;
    if (parsed.title) setTitle(parsed.title);
    setSections(parsed.sections.map((s) => createEmptySection(s)));
    setPasteText('');
    return true;
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

  const handleRemoveSection = useCallback((id) => {
    setSections((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.length <= 1) {
        // 마지막 1개는 삭제 대신 초기화
        return [createEmptySection()];
      }
      return arr.filter((s) => s.id !== id);
    });
  }, []);

  const handleChangeSection = useCallback((id, field, value) => {
    setSections((prev) => (Array.isArray(prev) ? prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)) : prev));
  }, []);

  const handleAddAroundPlace = useCallback((sectionId) => {
    setSections((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) => {
        if (s.id !== sectionId) return s;
        const next = Array.isArray(s.aroundPlaces) ? s.aroundPlaces.slice() : [];
        next.push({ id: `ap-${Date.now()}-${Math.random().toString(16).slice(2)}`, info: '', desc: '' });
        return { ...s, aroundPlaces: next };
      })
    );
  }, []);

  const handleRemoveAroundPlace = useCallback((sectionId, placeId) => {
    setSections((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) => {
        if (s.id !== sectionId) return s;
        const next = (Array.isArray(s.aroundPlaces) ? s.aroundPlaces : []).filter((p) => p.id !== placeId);
        return {
          ...s,
          aroundPlaces: next.length ? next : [{ id: `ap-${Date.now()}-1`, info: '', desc: '' }],
        };
      })
    );
  }, []);

  const handleChangeAroundPlace = useCallback((sectionId, placeId, field, value) => {
    setSections((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) => {
        if (s.id !== sectionId) return s;
        const next = (Array.isArray(s.aroundPlaces) ? s.aroundPlaces : []).map((p) => (p.id === placeId ? { ...p, [field]: value } : p));
        return { ...s, aroundPlaces: next };
      })
    );
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
          aroundPlaces: Array.isArray(s?.aroundPlaces) ? s.aroundPlaces : [],
        }))
        .filter((s) => s.locationTitle || s.locationInfo || s.description || (s.aroundPlaces && s.aroundPlaces.length));
      if (normalizedSections.length === 0) {
        alert('최소 1개의 위치를 입력해 주세요.');
        return;
      }
      if (!normalizedSections.some((s) => s.locationTitle && s.description)) {
        alert('위치와 위치에 대한 설명은 최소 1개 이상 입력해 주세요.');
        return;
      }

      setSaving(true);
      const res = await publishMagazine({
        title: title.trim(),
        subtitle: '',
        sections: normalizedSections.map((s) => ({
          location: s.locationTitle || s.locationInfo || title.trim(),
          locationInfo: s.locationInfo,
          description: s.description,
          around: (Array.isArray(s.aroundPlaces) ? s.aroundPlaces : [])
            .map((p) => ({
              id: p?.id || `ap-${Date.now()}`,
              info: String(p?.info || '').trim(),
              desc: String(p?.desc || '').trim(),
            }))
            .filter((p) => p.info || p.desc)
            .slice(0, 12),
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

            <div>
              <label className="block mb-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100">
                복사한 글 붙여넣기 (자동 입력)
              </label>
              <textarea
                className="w-full min-h-[110px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-gray-900/30 px-3 py-2 text-[13px] leading-relaxed text-gray-900 dark:text-gray-50 focus:outline-none resize-none"
                placeholder="여기에 전체 내용을 붙여넣으면 위치/설명/주변장소가 자동으로 채워져요."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onBlur={() => { applyPaste(pasteText); }}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const ok = applyPaste(pasteText);
                    if (!ok) alert('형식을 인식하지 못했어요. (1., 2., 3. 섹션/위치정보/위치 설명/위치 주변 문구가 있는지 확인해 주세요)');
                  }}
                  className="rounded-full bg-gray-900 text-white px-4 py-2 text-[12px] font-semibold"
                >
                  자동 채우기
                </button>
              </div>
            </div>

            {sections.map((sec, idx) => (
              <section key={sec.id} className="pt-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[12px] font-extrabold text-gray-900 dark:text-gray-50">
                    위치 {idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(sec.id)}
                    className="text-[12px] font-semibold text-rose-600 px-2 py-1"
                  >
                    삭제
                  </button>
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
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                      {(Array.isArray(sec.aroundPlaces) ? sec.aroundPlaces : []).map((p, pi) => (
                        <div
                          key={p.id}
                          className="flex-shrink-0 w-[240px] border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 bg-white/40 dark:bg-gray-900/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[12px] font-extrabold text-gray-900 dark:text-gray-50">주변장소 {pi + 1}</div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAroundPlace(sec.id, p.id)}
                              className="text-[12px] font-semibold text-rose-600"
                            >
                              삭제
                            </button>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">위치정보</div>
                              <input
                                className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2 text-[13px] text-gray-900 dark:text-gray-50 focus:outline-none"
                                placeholder="예: 방화수류정"
                                value={p.info}
                                onChange={(e) => handleChangeAroundPlace(sec.id, p.id, 'info', e.target.value)}
                              />
                            </div>
                            <div>
                              <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">간단한 위치설명</div>
                              <input
                                className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2 text-[13px] text-gray-900 dark:text-gray-50 focus:outline-none"
                                placeholder="예: 야경이 예쁜 정자"
                                value={p.desc}
                                onChange={(e) => handleChangeAroundPlace(sec.id, p.id, 'desc', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddAroundPlace(sec.id)}
                        className="flex-shrink-0 w-[76px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-gray-900/40 flex items-center justify-center text-[13px] font-extrabold text-gray-900 dark:text-gray-50"
                        aria-label="주변장소 추가"
                      >
                        + 추가
                      </button>
                    </div>
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

