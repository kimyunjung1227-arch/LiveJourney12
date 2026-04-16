import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDisplayImageUrl } from '../api/upload';
import { getGridCoverDisplay } from '../utils/postMedia';
import { formatExifDate } from '../utils/exifExtractor';
import {
  feedGridCardBoxFlat,
  feedGridImageBoxFlat,
  feedGridInfoBox,
  feedGridTitleStyle,
  feedGridDescStyle,
  feedGridMetaRow,
} from '../utils/feedGridCardStyles';

const getPostTimeMs = (post) => {
  const raw = post?.timestamp || post?.createdAt || post?.time || post?.photoDate;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const getUserIdForPost = (post) => {
  const uid = post?.userId ?? post?.user?.id ?? post?.user ?? post?.authorId ?? post?.author?.id;
  return uid != null ? String(uid) : '';
};

const getUserNameForPost = (post) => {
  const who = post?.user?.username || post?.user?.name || post?.author_username || post?.username;
  return String(who || '여행자');
};

const hasExifForPost = (post) => {
  const ex = post?.exifData;
  return !!(
    post?.photoDate ||
    (ex && typeof ex === 'object' && (ex.photoDate || ex.gpsCoordinates || ex.cameraMake || ex.cameraModel))
  );
};

const getExifTagForPost = (post) => {
  const photoDate = post?.photoDate || post?.exifData?.photoDate || null;
  const ex = post?.exifData && typeof post.exifData === 'object' ? post.exifData : null;
  const cameraMake = ex?.cameraMake ? String(ex.cameraMake).trim() : '';
  const cameraModel = ex?.cameraModel ? String(ex.cameraModel).trim() : '';
  const cameraText = `${cameraMake} ${cameraModel}`.trim();

  let timeText = '';
  let fullTimeText = '';
  if (photoDate) {
    const d = new Date(photoDate);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      timeText = `${hh}:${mm}`;
      fullTimeText = d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
  }

  const dayText = photoDate ? (formatExifDate(photoDate) || '') : '';
  const parts = [dayText, timeText].filter(Boolean);
  const when = parts.join(' ');
  const text = [when, cameraText].filter(Boolean).join(' · ');
  const title = [fullTimeText ? `촬영: ${fullTimeText}` : '', cameraText ? `기기: ${cameraText}` : ''].filter(Boolean).join('\n');

  return text ? { text, title } : null;
};

const getPlaceKeyForPost = (post) =>
  String(post?.location || post?.placeName || post?.detailedLocation || post?.region || '').trim();

const pickKeywords = (posts) => {
  const map = new Map();
  const bump = (k, inc = 1) => {
    const key = String(k || '').trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + inc);
  };
  (posts || []).forEach((p) => {
    const tags = [
      ...(Array.isArray(p?.reasonTags) ? p.reasonTags : []),
      ...(Array.isArray(p?.aiHotTags) ? p.aiHotTags : []),
      ...(Array.isArray(p?.tags) ? p.tags : []),
    ];
    tags.forEach((t) => {
      const raw = String(t || '').replace(/#/g, '').replace(/_/g, ' ').trim();
      if (raw) bump(`#${raw}`, 2);
    });
    const text = `${p?.note || ''} ${p?.content || ''}`.trim();
    const hashes = text.match(/#[^\s#]+/g) || [];
    hashes.forEach((h) => bump(h.replace(/_/g, ' '), 3));
    // 가벼운 키워드 추출(과도한 NLP는 생략)
    ['만개', '절정', '사람 많', '사람 보통', '한산', '바람', '웨이팅', '줄', '혼잡', '꽃', '단풍', '야경'].forEach((k) => {
      if (text.includes(k)) bump(`#${k.replace(/\s+/g, '')}`, 1);
    });
  });
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 3);
};

export default function HotplaceLiveFeedScreen() {
  const navigate = useNavigate();
  const loc = useLocation();
  const params = useParams();
  const encoded = String(params.placeKey || '');
  const placeKey = useMemo(() => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }, [encoded]);

  const allPosts = (loc.state?.allPosts && Array.isArray(loc.state.allPosts)) ? loc.state.allPosts : [];

  const postsForPlace = useMemo(() => {
    const key = String(loc.state?.placeKey || placeKey || '').trim();
    if (!key) return [];
    return allPosts
      .filter((p) => p && getPlaceKeyForPost(p) === key)
      .sort((a, b) => getPostTimeMs(b) - getPostTimeMs(a));
  }, [allPosts, loc.state?.placeKey, placeKey]);

  const now = Date.now();
  const recent2h = useMemo(
    () => postsForPlace.filter((p) => now - getPostTimeMs(p) <= 2 * 60 * 60 * 1000),
    [postsForPlace, now],
  );
  const recent30m = useMemo(
    () => postsForPlace.filter((p) => now - getPostTimeMs(p) <= 30 * 60 * 1000).slice(0, 5),
    [postsForPlace, now],
  );

  const compassCount = useMemo(() => {
    const s = new Set();
    recent2h.forEach((p) => {
      const uid = getUserIdForPost(p);
      if (uid) s.add(uid);
    });
    return s.size;
  }, [recent2h]);

  const topContributors = useMemo(() => {
    const counts = new Map();
    recent2h.forEach((p) => {
      const uid = getUserIdForPost(p) || getUserNameForPost(p);
      counts.set(uid, (counts.get(uid) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([uid, n]) => ({ uid, n }));
  }, [recent2h]);

  const brief = useMemo(() => {
    const keys = pickKeywords(recent2h);
    if (!placeKey) return '';
    if (keys.length === 0) return `현재 ${placeKey}의 최신 제보가 모이는 중입니다.`;
    return `현재 ${placeKey}은(는) ${keys.join(' ')} 상태입니다.`;
  }, [placeKey, recent2h]);

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-border-light bg-background-light px-3 py-3 dark:border-border-dark dark:bg-background-dark">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-primary-light hover:bg-black/5 dark:text-text-primary-dark dark:hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h1 className="min-w-0 flex-1 pr-2 text-center text-[17px] font-bold leading-snug text-text-primary-light dark:text-text-primary-dark">
          {String(loc.state?.placeKey || placeKey || '실시간 현장').trim()}
        </h1>
        <div className="size-10 shrink-0" aria-hidden />
      </header>

      <div className="screen-content flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="px-4 pb-20 pt-3">
          <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-extrabold text-primary">3초 분위기 요약</p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-zinc-800 dark:text-zinc-100">
              {brief}
            </p>
            <p className="mt-2 text-[12px] font-medium text-zinc-600 dark:text-zinc-400">
              지금 {compassCount}명의 컴퍼스가 중계 중 · 최근 2시간 기준
            </p>
            {topContributors.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {topContributors.map((c) => (
                  <span
                    key={String(c.uid)}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200"
                    style={{ borderColor: 'rgba(38,198,218,0.28)', background: 'rgba(38,198,218,0.10)' }}
                    title="중계 기여도"
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ color: '#0891b2' }} aria-hidden>
                      person
                    </span>
                    <span className="max-w-[160px] truncate">{String(c.uid).slice(0, 18)}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">· {c.n}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {recent30m.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-extrabold text-zinc-900 dark:text-zinc-50">방금 전</p>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">최근 30분 · 5장</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide">
                {recent30m.map((p) => {
                  const cover = getGridCoverDisplay(p, getDisplayImageUrl);
                  const src = cover?.src || (Array.isArray(p.images) ? p.images[0] : p.image) || p.thumbnail || '';
                  const url = src ? getDisplayImageUrl(src) : '';
                  return (
                    <button
                      key={String(p.id)}
                      type="button"
                      onClick={() => navigate(`/post/${p.id}`, { state: { post: p, allPosts } })}
                      className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-2xl bg-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
                    >
                      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-extrabold text-zinc-900 dark:text-zinc-50">개별 피드</p>
              {postsForPlace.some(hasExifForPost) ? (
                <span
                  className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-extrabold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  title="촬영 정보(EXIF) 기반"
                >
                  EXIF 태그
                </span>
              ) : null}
            </div>

            {postsForPlace.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">표시할 게시물이 없어요.</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  rowGap: '8px',
                  columnGap: '8px',
                }}
              >
                {postsForPlace.map((post) => {
                  const cover = getGridCoverDisplay(post, getDisplayImageUrl);
                  const exifTag = getExifTagForPost(post);
                  return (
                    <div
                      key={String(post.id)}
                      onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts } })}
                      style={{ ...feedGridCardBoxFlat, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                      role="presentation"
                    >
                      <div style={feedGridImageBoxFlat}>
                        {cover?.mode === 'img' && cover.src ? (
                          <img
                            src={cover.src}
                            alt=""
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : cover?.mode === 'video' && cover.src ? (
                          <video
                            src={cover.src}
                            muted
                            playsInline
                            preload="metadata"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : null}
                        {hasExifForPost(post) && exifTag ? (
                          <div
                            className="absolute left-2 top-2 z-[2] max-w-[92%] rounded-full border px-2 py-1 text-[10px] font-extrabold truncate"
                            style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.14)', color: '#064e3b' }}
                            title={exifTag.title || exifTag.text}
                          >
                            {exifTag.text}
                          </div>
                        ) : null}
                      </div>

                      <div style={feedGridInfoBox}>
                        <div style={feedGridTitleStyle}>{getUserNameForPost(post)}</div>
                        {(post.content || post.note) && <div style={feedGridDescStyle}>{post.content || post.note}</div>}
                        <div style={feedGridMetaRow}>
                          <span>{new Date(getPostTimeMs(post) || Date.now()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="truncate">{String(post.location || '').trim()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

