import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import MagazinePublishedCarousel from '../components/MagazinePublishedCarousel';
import { publishMagazine } from '../utils/magazinesStore';
import { useAuth } from '../contexts/AuthContext';
import { useAdminState } from '../utils/admin';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getCombinedPosts } from '../utils/mockData';
import { buildSlidesForMagazine, getGridPostsPool, getRegionPostsForSlide } from '../utils/magazinePublishedUi';
import { getUploadedPostsSafe } from '../utils/localStorageManager';

const DRAFT_KEY = 'magazinePublishDraft';

const extractBetween = (text, startRe, endRe) => {
  const s = text.search(startRe);
  if (s < 0) return '';
  const after = text.slice(s).replace(startRe, '');
  if (!endRe) return after.trim();
  const e = after.search(endRe);
  return (e < 0 ? after : after.slice(0, e)).trim();
};

const normalizeSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const pickLabelLine = (body, labelRe) => {
  const mm = String(body || '').match(labelRe);
  return mm ? String(mm[1] || '').trim() : '';
};

const parsePreviewName = (rawLine) => {
  const line = String(rawLine || '').trim();
  if (!line) return '';
  // "불국사 토함산 식당 (피드 언급 1위: ...)" -> "불국사 토함산 식당"
  return normalizeSpace(line.split('(')[0]).replace(/[:：]\s*$/, '').trim();
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
    const moodTitle = String(m[3] || '').trim();
    const body = String(m[4] || '');
    const locationTitle = pickLabelLine(body, /장소\s*이름\s*:\s*([^\n]+)/i) || moodTitle;
    const locationInfo = pickLabelLine(body, /위치정보\s*:\s*([^\n]+)/i);
    const description = extractBetween(body, /장소\s*설명\s*:\s*/i, /\n\s*\[LiveJourney Preview\]|\n\s*💡|$/i);

    const previewFoodRaw = pickLabelLine(body, /🍴\s*맛집\s*:\s*([^\n]+)/i);
    const previewSpotRaw = pickLabelLine(body, /🚩\s*명소\s*:\s*([^\n]+)/i);
    const previewFood = parsePreviewName(previewFoodRaw);
    const previewSpot = parsePreviewName(previewSpotRaw);
    const around = [previewFood, previewSpot].filter(Boolean);
    const realtimeFeed = pickLabelLine(body, /📸\s*실시간\s*피드\s*:\s*([^\n]+)/i);

    const extraLines = [];
    if (around.length > 0 || realtimeFeed) {
      extraLines.push('[LiveJourney Preview]');
      if (previewFoodRaw) extraLines.push(`🍴 맛집: ${previewFoodRaw}`);
      if (previewSpotRaw) extraLines.push(`🚩 명소: ${previewSpotRaw}`);
      if (realtimeFeed) extraLines.push(`📸 실시간 피드: ${realtimeFeed}`);
    }

    const mergedDescription = [description, extraLines.join('\n')].filter((v) => String(v || '').trim()).join('\n\n');

    blocks.push({
      moodTitle: moodTitle.replace(/^['"]|['"]$/g, '').trim(),
      locationTitle: locationTitle.replace(/^['"]|['"]$/g, '').trim(),
      locationInfo,
      description: mergedDescription,
      around,
    });
  }

  if (!blocks.length) return null;
  return { title: titleLine, sections: blocks };
};

const createEmptySection = (seed = {}) => ({
  id: `sec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  moodTitle: seed.moodTitle || '',
  locationTitle: seed.locationTitle || '',
  locationInfo: seed.locationInfo || '',
  description: seed.description || '',
  around: Array.isArray(seed.around) ? seed.around : [],
});

const MagazineWriteScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminState(user);
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState([createEmptySection()]);
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [allPosts, setAllPosts] = useState([]);
  const [feedRefresh, setFeedRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const localPosts = getUploadedPostsSafe();
        const supabasePosts = await fetchPostsSupabase();
        const byId = new Map();
        [...(Array.isArray(supabasePosts) ? supabasePosts : []), ...(Array.isArray(localPosts) ? localPosts : [])].forEach(
          (p) => {
            if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
          }
        );
        const combined = getCombinedPosts(Array.from(byId.values()));
        if (alive) setAllPosts(combined);
      } catch {
        if (alive) setAllPosts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [feedRefresh]);

  useEffect(() => {
    const id = setInterval(() => setFeedRefresh((n) => n + 1), 45000);
    const onVis = () => {
      if (document.visibilityState === 'visible') setFeedRefresh((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

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
              moodTitle: s?.moodTitle,
              locationTitle: s?.locationTitle,
              locationInfo: s?.locationInfo,
              description: s?.description,
              around: s?.around,
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

  const previewMagazine = useMemo(() => {
    if (!title.trim()) return null;
    const normalizedSections = (Array.isArray(sections) ? sections : [])
      .map((s) => ({
        moodTitle: String(s?.moodTitle || '').trim(),
        locationTitle: String(s?.locationTitle || '').trim(),
        locationInfo: String(s?.locationInfo || '').trim(),
        description: String(s?.description || '').trim(),
        around: Array.isArray(s?.around) ? s.around.filter((x) => String(x || '').trim()) : [],
      }))
      .filter((s) => s.locationTitle || s.locationInfo || s.description);
    if (normalizedSections.length === 0) return null;
    if (!normalizedSections.some((s) => s.locationTitle && s.description)) return null;
    return {
      id: 'draft-preview',
      title: title.trim(),
      subtitle: '',
      author: user?.email || user?.username || 'LiveJourney',
      createdAt: new Date().toISOString(),
      sections: normalizedSections.map((s) => ({
        location: s.locationTitle || s.locationInfo || title.trim(),
        moodTitle: s.moodTitle,
        locationInfo: s.locationInfo,
        description: s.description,
        around: s.around,
      })),
    };
  }, [title, sections, user?.email, user?.username]);

  const gridPostsPub = useMemo(() => getGridPostsPool(allPosts), [allPosts]);
  const previewSlides = useMemo(
    () => (previewMagazine ? buildSlidesForMagazine(previewMagazine, allPosts, gridPostsPub) : []),
    [previewMagazine, allPosts, gridPostsPub]
  );
  const previewPostsPerSlide = useMemo(
    () => previewSlides.map((slide) => getRegionPostsForSlide(slide, allPosts, gridPostsPub)),
    [previewSlides, allPosts, gridPostsPub]
  );

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

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!title.trim()) {
        alert('제목을 입력해 주세요.');
        return;
      }
      const normalizedSections = (Array.isArray(sections) ? sections : [])
        .map((s) => ({
          moodTitle: String(s?.moodTitle || '').trim(),
          locationTitle: String(s?.locationTitle || '').trim(),
          locationInfo: String(s?.locationInfo || '').trim(),
          description: String(s?.description || '').trim(),
          around: Array.isArray(s?.around) ? s.around.filter((x) => String(x || '').trim()) : [],
        }))
        .filter((s) => s.locationTitle || s.locationInfo || s.description);
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
          moodTitle: s.moodTitle,
          locationInfo: s.locationInfo,
          description: s.description,
          around: s.around,
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
        <header className="screen-header flex-shrink-0 grid grid-cols-[minmax(40px,1fr)_auto_minmax(40px,1fr)] items-center gap-1 px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex justify-start min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="뒤로"
            >
              <span className="material-symbols-outlined text-[22px] text-text-primary-light dark:text-text-primary-dark">
                arrow_back
              </span>
            </button>
          </div>
          <h1 className="text-[17px] font-extrabold text-text-primary-light dark:text-text-primary-dark m-0 truncate text-center max-w-[min(280px,70vw)]">
            {previewSlides.length > 0 ? '여행 매거진' : '매거진 발행'}
          </h1>
          <div className="flex shrink-0 items-center justify-end gap-2 min-w-0">
            <button
              type="button"
              onClick={saveDraft}
              className="text-[13px] font-semibold text-gray-600 dark:text-gray-300 px-1 py-2 min-w-0"
            >
              임시저장
            </button>
            <button
              type="submit"
              form="magazine-publish-form"
              disabled={!canSubmit || saving}
              className={`text-[13px] font-extrabold px-1 py-2 min-w-[40px] ${
                !canSubmit || saving ? 'text-gray-300 dark:text-gray-600' : 'text-[#22c55e]'
              }`}
            >
              등록
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth px-4 pt-3 pb-24 max-w-full [-webkit-overflow-scrolling:touch]">
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
            <>
              {/* MagazineDetailScreen(발행 매거진)과 동일: 상단 미리보기 = 캐러셀만 */}
              {previewSlides.length > 0 ? (
                <div className="w-full shrink-0">
                  <MagazinePublishedCarousel variant="detail" slides={previewSlides} postsPerSlide={previewPostsPerSlide} />
                </div>
              ) : (
                <div className="w-full shrink-0 flex flex-col items-center justify-center px-2 py-10 text-center">
                  <span className="material-symbols-outlined text-5xl text-zinc-300 dark:text-zinc-600 mb-3">book_5</span>
                  <p className="m-0 text-[14px] font-medium text-gray-800 dark:text-gray-100 mb-1">
                    미리보기를 불러올 수 있어요
                  </p>
                  <p className="m-0 text-[13px] text-gray-500 dark:text-gray-400 max-w-[280px] leading-relaxed">
                    아래에서 제목과 장소·설명을 입력하면 매거진 상세 화면과 같은 구조로 여기에 표시돼요.
                  </p>
                </div>
              )}

              <form
                id="magazine-publish-form"
                className="space-y-6 pb-8 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800"
                onSubmit={handleSubmit}
              >
                <div className="rounded-xl border border-zinc-100 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-gray-900/40">
                  <p className="m-0 mb-3 text-[13px] font-bold text-gray-900 dark:text-gray-50">발행 내용 편집</p>
                  <div>
                    <label className="block mb-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300">매거진 제목</label>
                    <input
                      className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[16px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none"
                      placeholder="제목"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-gray-900/40">
                  <label className="block mb-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                    복사한 글 붙여넣기 (자동 입력)
                  </label>
                  <textarea
                    className="w-full min-h-[100px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-gray-900/30 px-3 py-2 text-[13px] leading-relaxed text-gray-900 dark:text-gray-50 focus:outline-none resize-none"
                    placeholder="전체 문구를 붙여넣으면 장소·설명·주변이 채워져요."
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    onBlur={() => {
                      applyPaste(pasteText);
                    }}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const ok = applyPaste(pasteText);
                        if (!ok) {
                          alert(
                            '형식을 인식하지 못했어요. (1., 2., 3. 섹션/장소 이름/위치정보/장소 설명 문구가 있는지 확인해 주세요)'
                          );
                        }
                      }}
                      className="rounded-full bg-gray-900 text-white px-4 py-2 text-[12px] font-semibold"
                    >
                      자동 채우기
                    </button>
                  </div>
                </div>

                {sections.map((sec, idx) => (
                  <section key={sec.id} className="rounded-xl border border-zinc-100 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-gray-900/40">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-primary">장소 {idx + 1}</div>
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
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">분위기 제목</label>
                        <input
                          className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[15px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none"
                          placeholder="예: 핑크빛 솜사탕의 실시간 현황"
                          value={sec.moodTitle}
                          onChange={(e) => handleChangeSection(sec.id, 'moodTitle', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">장소 이름</label>
                        <input
                          className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[15px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none"
                          placeholder="예: 경기 수원"
                          value={sec.locationTitle}
                          onChange={(e) => handleChangeSection(sec.id, 'locationTitle', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">위치정보</label>
                        <input
                          className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none"
                          placeholder="예: 수원 화성 · 수원시 팔달구"
                          value={sec.locationInfo}
                          onChange={(e) => handleChangeSection(sec.id, 'locationInfo', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">장소 설명</label>
                        <textarea
                          className="w-full min-h-[120px] bg-transparent px-0 py-2 text-[15px] leading-relaxed text-gray-900 dark:text-gray-50 focus:outline-none resize-none"
                          placeholder="설명을 입력하세요."
                          value={sec.description}
                          onChange={(e) => handleChangeSection(sec.id, 'description', e.target.value)}
                        />
                      </div>

                      <p className="m-0 rounded-lg bg-zinc-50/90 px-3 py-2 text-[11px] leading-relaxed text-gray-600 dark:bg-zinc-900/40 dark:text-gray-400">
                        장소 이름·위치를 입력하면 미리보기에서{' '}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">주변 맛집·명소 추천</span>이 지역 데이터와
                        피드 사진을 바탕으로 자동 표시돼요.
                      </p>
                    </div>
                  </section>
                ))}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="w-full rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-gray-900/40 py-3 text-[14px] font-extrabold text-gray-900 dark:text-gray-50"
                  >
                    + 장소 추가하기
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MagazineWriteScreen;

