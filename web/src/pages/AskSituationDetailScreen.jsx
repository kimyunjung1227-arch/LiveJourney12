import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { fetchPostByIdSupabase } from '../api/postsSupabase';
import { fetchCommentsForPostSupabase } from '../api/socialSupabase';
import { supabase } from '../utils/supabaseClient';
import { uploadImage, getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

const isQuestionPost = (p) => String(p?.category || '').toLowerCase() === 'question';

// DB 스키마 변경 없이 "답변 사진"을 저장하기 위한 포맷(JSON 문자열)
const encodeAnswerContent = ({ text, imageUrl, imageUrls }) => {
  const t = String(text || '').trim();
  const imgs = Array.isArray(imageUrls)
    ? imageUrls.map((u) => String(u || '').trim()).filter(Boolean)
    : (imageUrl ? [String(imageUrl).trim()] : []);
  if (imgs.length === 0) return t;
  return JSON.stringify({ t, imgs });
};

const decodeAnswerContent = (raw) => {
  const s = String(raw || '');
  if (!s) return { text: '', imageUrl: null };
  const trimmed = s.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return { text: trimmed, imageUrl: null };
  try {
    const obj = JSON.parse(trimmed);
    const text = typeof obj?.t === 'string' ? obj.t : (typeof obj?.text === 'string' ? obj.text : '');
    const imageUrl = typeof obj?.img === 'string' && obj.img.trim() ? obj.img.trim() : null;
    const imageUrls = Array.isArray(obj?.imgs)
      ? obj.imgs.map((u) => String(u || '').trim()).filter(Boolean)
      : (imageUrl ? [imageUrl] : []);
    return { text: String(text || '').trim(), imageUrl, imageUrls };
  } catch {
    return { text: trimmed, imageUrl: null };
  }
};

const getKakaoAppKey = () => String(import.meta.env.VITE_KAKAO_MAP_API_KEY || '').trim();
const loadKakaoSdkOnce = (appKey) =>
  new Promise((resolve, reject) => {
    const key = String(appKey || '').trim();
    if (!key) {
      reject(new Error('VITE_KAKAO_MAP_API_KEY가 비어있습니다.'));
      return;
    }
    if (window.kakao?.maps) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-kakao-maps-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Kakao Maps SDK 로드 실패')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.kakaoMapsSdk = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kakao Maps SDK 로드 실패'));
    document.head.appendChild(script);
  });

const ensureKakaoReady = async () => {
  const key = getKakaoAppKey();
  await loadKakaoSdkOnce(key);
  await new Promise((resolve, reject) => {
    try {
      if (!window.kakao?.maps?.load) {
        reject(new Error('Kakao Maps SDK 초기화 실패'));
        return;
      }
      window.kakao.maps.load(() => resolve());
    } catch (e) {
      reject(e);
    }
  });
};

export default function AskSituationDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const passed = location.state?.post || null;

  const [post, setPost] = useState(passed);
  const passedMatchesRoute = Boolean(passed && id && String(passed.id) === String(id));
  const [loading, setLoading] = useState(!passedMatchesRoute);
  const [comments, setComments] = useState([]);
  const [acceptedCommentId, setAcceptedCommentId] = useState(null);
  const [acceptBusyId, setAcceptBusyId] = useState(null);

  const [answerText, setAnswerText] = useState('');
  const [answerUploading, setAnswerUploading] = useState(false);
  const [answerImageUrls, setAnswerImageUrls] = useState([]); // 여러 장 업로드 지원
  const [hasAnsweredByMe, setHasAnsweredByMe] = useState(false);
  const fileRef = useRef(null);

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapErr, setMapErr] = useState(null);
  const floatingLayerStyle = useMemo(() => ({
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(414px, 100vw)',
    zIndex: 60,
  }), []);

  const coords = useMemo(() => {
    const c = post?.coordinates || post?.exifData?.map_pin || null;
    const lat = c ? Number(c.lat) : NaN;
    const lng = c ? Number(c.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [post]);

  // 답변 사진 스트립: 데스크톱에서도 마우스 드래그로 좌우 슬라이드(수평 스크롤) 가능하게
  const dragStateRef = useRef(null);
  const onAnswerImageStripMouseDown = useCallback((e) => {
    if (!e?.currentTarget) return;
    if (e.button != null && e.button !== 0) return; // 좌클릭만
    const el = e.currentTarget;
    dragStateRef.current = {
      el,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
    try {
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      const st = dragStateRef.current;
      if (!st || st.el !== el) return;
      const dx = ev.clientX - st.startX;
      if (Math.abs(dx) > 3) st.moved = true;
      st.el.scrollLeft = st.startScrollLeft - dx;
      ev.preventDefault?.();
    };
    const onUp = () => {
      const st = dragStateRef.current;
      dragStateRef.current = null;
      try {
        el.style.cursor = 'grab';
        el.style.userSelect = '';
      } catch {
        /* ignore */
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // 드래그로 스크롤한 경우 클릭(이미지 열기 등) 오동작 방지용
      if (st?.moved) {
        try {
          el.dataset.dragged = '1';
          setTimeout(() => {
            try { delete el.dataset.dragged; } catch { /* ignore */ }
          }, 0);
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const canAccept = useMemo(() => {
    if (!user || !post) return false;
    if (!isQuestionPost(post)) return false;
    const authorId = String(post.userId || post.user?.id || post.user_id || '').trim();
    return authorId && String(authorId) === String(user.id);
  }, [post, user]);

  const answerImagesStillUploading = useMemo(
    () => (Array.isArray(answerImageUrls) ? answerImageUrls : []).some((u) => String(u || '').startsWith('blob:')),
    [answerImageUrls],
  );

  const canEditQuestion = useMemo(() => {
    if (!user || !post) return false;
    if (!isQuestionPost(post)) return false;
    const authorId = String(post.userId || post.user?.id || post.user_id || '').trim();
    return authorId && String(authorId) === String(user.id);
  }, [post, user]);

  const load = useCallback(async ({ background = false } = {}) => {
    const pid = String(id || '').trim();
    if (!isUuid(pid)) return;
    if (!background) setLoading(true);
    try {
      const [fresh, rows, acceptRes] = await Promise.all([
        fetchPostByIdSupabase(pid, user?.id || null, { skipComments: true }),
        fetchCommentsForPostSupabase(pid),
        supabase.from('help_answer_accepts').select('comment_id').eq('post_id', pid).maybeSingle(),
      ]);
      if (fresh) setPost(fresh);
      const mapped = (rows || []).map((c) => {
        const payload = decodeAnswerContent(c.content);
        return {
          id: String(c.id),
          userId: c.user_id ? String(c.user_id) : null,
          user: c.user_id ? { id: String(c.user_id), username: c.username || null, profileImage: c.avatar_url || null } : (c.username || '유저'),
          createdAt: c.created_at || null,
          avatar: c.avatar_url || null,
          text: payload.text,
          imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls : (payload.imageUrl ? [payload.imageUrl] : []),
        };
      });
      setComments(mapped);
      if (user?.id) {
        const me = String(user.id);
        setHasAnsweredByMe(mapped.some((x) => x?.userId && String(x.userId) === me));
      }
      if (!acceptRes?.error) setAcceptedCommentId(acceptRes?.data?.comment_id || null);
    } catch (e) {
      logger.warn('AskSituationDetail load 실패:', e?.message);
    } finally {
      if (!background) setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    void load({ background: passedMatchesRoute });
  }, [load, passedMatchesRoute]);

  /** 라우트 id 변경 시 목록에서 넘긴 state(post)가 이전 글이면 사용하지 않음 */
  useEffect(() => {
    const pid = String(id || '').trim();
    if (passed && String(passed.id) === pid) setPost(passed);
    else setPost(null);
  }, [id, passed]);

  // 지도(가볍게)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!coords || !mapElRef.current) return;
      try {
        await ensureKakaoReady();
        if (cancelled) return;
        const kakao = window.kakao;
        const pos = new kakao.maps.LatLng(coords.lat, coords.lng);
        const map = new kakao.maps.Map(mapElRef.current, {
          center: pos,
          level: 4,
          draggable: false,
          scrollwheel: false,
        });
        mapRef.current = map;
        const marker = new kakao.maps.Marker({ position: pos });
        marker.setMap(map);
        markerRef.current = marker;
      } catch (e) {
        setMapErr('지도를 불러오지 못했어요.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  const onPickFile = useCallback(async (e) => {
    const files = Array.from(e?.target?.files || []).filter(Boolean);
    if (files.length === 0) return;
    if (!user?.id) {
      alert('로그인 후 답변할 수 있어요.');
      return;
    }

    let baseLen = 0;
    let slice = [];
    let localUrls = [];

    setAnswerImageUrls((prev) => {
      const p = prev || [];
      baseLen = p.length;
      const room = Math.max(0, 6 - baseLen);
      slice = files.slice(0, room);
      localUrls = slice.map((f) => URL.createObjectURL(f));
      return [...p, ...localUrls].slice(0, 6);
    });

    if (slice.length === 0) {
      try {
        e.target.value = '';
      } catch {
        /* ignore */
      }
      return;
    }

    setAnswerUploading(true);
    try {
      const results = await Promise.all(
        slice.map((file) =>
          uploadImage(file, user.id).then(
            (res) => {
              const url = res?.imageUrl || res?.url || null;
              return url ? getDisplayImageUrl(url) : null;
            },
            () => null,
          ),
        ),
      );
      setAnswerImageUrls((prev) => {
        const next = [...(prev || [])];
        results.forEach((remote, i) => {
          const idx = baseLen + i;
          if (remote && next[idx] === localUrls[i]) next[idx] = remote;
        });
        return next;
      });
      localUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      if (!results.some(Boolean)) throw new Error('upload_failed');
    } catch {
      setAnswerImageUrls((prev) => (prev || []).filter((u) => !localUrls.includes(u)));
      localUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      alert('사진 업로드에 실패했어요.');
    } finally {
      setAnswerUploading(false);
      try {
        e.target.value = '';
      } catch {
        /* ignore */
      }
    }
  }, [user?.id]);

  const submitAnswer = useCallback(async () => {
    if (!post?.id || !isUuid(String(post.id))) return;
    if (!user?.id) {
      alert('로그인 후 답변할 수 있어요.');
      return;
    }
    if (hasAnsweredByMe) {
      alert('이 질문에는 이미 답변을 등록했어요. (답변은 1회만 가능해요)');
      return;
    }
    const text = String(answerText || '').trim();
    if (!text && (!Array.isArray(answerImageUrls) || answerImageUrls.length === 0)) {
      alert('답변 내용을 입력하거나 사진을 첨부해 주세요.');
      return;
    }
    try {
      // 서버 중복 방지(베스트 에포트): 이미 내 답변이 있으면 차단
      const { data: existing } = await supabase
        .from('post_comments')
        .select('id')
        .eq('post_id', String(post.id))
        .eq('user_id', String(user.id))
        .limit(1);
      if (Array.isArray(existing) && existing.length > 0) {
        setHasAnsweredByMe(true);
        alert('이 질문에는 이미 답변을 등록했어요. (답변은 1회만 가능해요)');
        return;
      }

      const payload = encodeAnswerContent({ text, imageUrl: null, imageUrls: answerImageUrls });
      const { data, error } = await supabase.from('post_comments').insert({
        post_id: String(post.id),
        user_id: String(user.id),
        username: user.username || user.email?.split('@')?.[0] || '유저',
        avatar_url: user.profileImage || user.avatar_url || null,
        content: payload,
      }).select('*').single();
      if (error) throw error;
      setAnswerText('');
      setAnswerImageUrls([]);
      setHasAnsweredByMe(true);
      setComments((prev) => ([
        ...prev,
        {
          id: String(data.id),
          userId: String(user.id),
          user: { id: String(user.id), username: user.username || null, profileImage: user.profileImage || null },
          createdAt: data.created_at || null,
          avatar: user.profileImage || null,
          text,
          imageUrls: Array.isArray(answerImageUrls) ? answerImageUrls : [],
        },
      ]));
    } catch (e) {
      alert('답변 등록에 실패했어요.');
      logger.warn('submitAnswer 실패:', e?.message);
    }
  }, [answerImageUrls, answerText, hasAnsweredByMe, post?.id, user]);

  const acceptAnswer = useCallback(async (comment) => {
    if (!canAccept || !post?.id || !comment?.id) return;
    if (acceptedCommentId) return;
    setAcceptBusyId(comment.id);
    try {
      const { data, error } = await supabase.rpc('accept_help_answer', { post: String(post.id), comment: String(comment.id) });
      if (error) throw error;
      const cid = data?.commentId ? String(data.commentId) : String(comment.id);
      setAcceptedCommentId(cid);
      alert('답변이 채택되었습니다! 답변자에게 응모권(활동 응모권) 1장이 지급됩니다.');
    } catch {
      alert('채택 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setAcceptBusyId(null);
    }
  }, [acceptedCommentId, canAccept, post?.id]);

  if (loading && !post) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <div className="text-[13px] text-gray-500">불러오는 중…</div>
      </div>
    );
  }

  if (!post || !isQuestionPost(post)) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 pt-12">
          <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
            <ArrowLeft className="h-5 w-5 text-gray-800" />
          </button>
          <h1 className="text-base font-bold text-gray-900">질문</h1>
        </header>
        <div className="p-4 text-[13px] text-gray-500">질문 글을 찾을 수 없어요.</div>
        <BottomNavigation />
      </div>
    );
  }

  const locationLabel = String(post.location || post.detailedLocation || post.placeName || post.region || '').trim();
  const questionText = String(post.content || post.note || '').trim();

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
      <div className="screen-content">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 pt-12 bg-white">
        <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
          <ArrowLeft className="h-5 w-5 text-gray-800" />
        </button>
        <h1 className="text-base font-bold text-gray-900">현장 상황 질문</h1>
        </div>
        {canEditQuestion ? (
          <button
            type="button"
            onClick={() => navigate(`/ask-situation/${encodeURIComponent(String(post.id))}/edit`, { state: { post } })}
            className="text-[13px] font-extrabold text-gray-700"
            style={{ minHeight: 36 }}
          >
            수정
          </button>
        ) : (
          <div style={{ width: 44 }} />
        )}
      </header>

      {/* 하단 고정 답변바 + 네비가 가리는 영역을 방지하기 위해 충분한 패딩 확보 */}
      <div className="flex-1 px-4 py-4" style={{ paddingBottom: 240 }}>
        {/* 위치 */}
        <div className="mb-3">
          <div className="text-[12px] font-extrabold text-gray-700">위치</div>
          <div className="mt-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-semibold text-gray-900">
            {locationLabel || '위치 정보 없음'}
          </div>
        </div>

        {/* 지도 */}
        <div className="mb-3">
          <div className="text-[12px] font-extrabold text-gray-700">지도</div>
          <div className="mt-1 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
            {mapErr ? <div className="px-3 py-2 text-[11px] text-gray-500">{mapErr}</div> : null}
            <div ref={mapElRef} className="h-[200px] w-full" />
          </div>
        </div>

        {/* 내용 */}
        <div className="mb-4">
          <div className="text-[12px] font-extrabold text-gray-700">내용</div>
          <div className="mt-1 rounded-2xl border border-gray-200 bg-white p-4 text-[14px] font-extrabold leading-relaxed text-gray-900">
            {questionText || '질문 내용이 없어요.'}
          </div>
          <div className="mt-2 text-[12px] font-bold" style={{ color: acceptedCommentId ? '#10b981' : '#94a3b8' }}>
            {acceptedCommentId ? '채택 완료' : '답변을 기다리고 있어요'}
          </div>
        </div>

        {/* 답변(사진) 리스트 */}
        <div className="mb-3">
          <div className="text-[12px] font-extrabold text-gray-700">다른 사용자 답변</div>
          <div className="mt-2 flex flex-col gap-10">
            {comments.length === 0 ? (
              <div style={{ padding: '12px 12px', borderRadius: 14, border: '1px solid #f1f5f9', background: '#fafafa', color: '#94a3b8', fontSize: 13 }}>
                아직 답변이 없어요. 사진과 함께 답변해보세요!
              </div>
            ) : (
              comments.map((c, cIdx) => {
                const avatar = c?.avatar || (typeof c.user === 'object' ? c.user?.profileImage : null) || null;
                const name = (typeof c.user === 'object' ? c.user?.username : null) || '유저';
                const imgs = Array.isArray(c.imageUrls) ? c.imageUrls.map((u) => getDisplayImageUrl(u)).filter(Boolean) : [];
                const accepted = acceptedCommentId && String(acceptedCommentId) === String(c.id);
                return (
                  <div
                    key={c.id}
                    style={{
                      border: '1px solid #eef2f7',
                      background: '#ffffff',
                      borderRadius: 16,
                      padding: 12,
                      boxShadow: '0 1px 4px rgba(15,23,42,0.03)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 overflow-hidden rounded-full bg-gray-100">
                        {avatar ? <img src={getDisplayImageUrl(avatar)} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-gray-800">{name}</div>
                      {accepted ? (
                        <div className="rounded-full px-2 py-1 text-[11px] font-extrabold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                          채택됨
                        </div>
                      ) : null}
                    </div>

                    {imgs.length > 0 ? (
                      <div
                        className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar"
                        onMouseDown={onAnswerImageStripMouseDown}
                        style={{
                          width: '100%',
                          scrollSnapType: 'x mandatory',
                          WebkitOverflowScrolling: 'touch',
                          cursor: 'grab',
                        }}
                      >
                        {imgs.slice(0, 6).map((src, i) => (
                          <div
                            key={`${c.id}-img-${i}`}
                            style={{
                              width: imgs.length === 1 ? '100%' : '78%',
                              maxWidth: '100%',
                              height: 180,
                              flex: '0 0 auto',
                              overflow: 'hidden',
                              borderRadius: 12, // 살짝 라운드
                              background: '#f1f5f9',
                              scrollSnapAlign: 'start',
                            }}
                          >
                            <img
                              src={src}
                              alt=""
                              className="h-full w-full object-cover"
                              loading={cIdx === 0 && i === 0 ? 'eager' : 'lazy'}
                              decoding="async"
                              fetchPriority={cIdx === 0 && i === 0 ? 'high' : undefined}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {c.text ? (
                      <div className="mt-2 text-[12px] font-semibold leading-relaxed text-gray-800">
                        {c.text}
                      </div>
                    ) : null}

                    {canAccept && !acceptedCommentId ? (
                      <button
                        type="button"
                        onClick={() => acceptAnswer(c)}
                        disabled={acceptBusyId === c.id}
                        className="mt-3 w-full rounded-2xl py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"
                        style={{ background: '#0ea5e9' }}
                      >
                        {acceptBusyId === c.id ? '라이브픽 처리 중…' : '라이브픽'}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 답변 입력(카메라) — 고정(fixed) 대신 본문과 함께 스크롤되도록 하단 섹션으로 배치 */}
      <div style={{ marginTop: 14, paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 14px)' }}>
        <div
          className="flex items-center gap-2"
          style={{
            flexWrap: 'nowrap',
          }}
        >
          <input
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="사진과 함께 답변하면 채택 확률이 높아져요!"
            disabled={hasAnsweredByMe}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[12px] font-semibold text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            style={{ minWidth: 0 }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={onPickFile}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={answerUploading}
            aria-label="사진 첨부"
            className="rounded-2xl border border-gray-200 bg-white px-2.5 py-2.5 disabled:opacity-40"
            style={{ flexShrink: 0, minHeight: 40 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0ea5e9', fontVariationSettings: "'wght' 300" }}>
              photo_camera
            </span>
          </button>
          <button
            type="button"
            onClick={submitAnswer}
            disabled={answerUploading || answerImagesStillUploading || hasAnsweredByMe}
            className="rounded-2xl px-3.5 py-2.5 text-[12px] font-extrabold text-white disabled:opacity-40"
            style={{ background: '#26C6DA', flexShrink: 0, minHeight: 40 }}
          >
            등록
          </button>
        </div>
        {Array.isArray(answerImageUrls) && answerImageUrls.length > 0 ? (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 min-w-0 overflow-x-auto hide-scrollbar">
                {answerImageUrls.slice(0, 6).map((u, i) => (
                  <div key={`pick-${i}`} className="h-10 w-10 overflow-hidden rounded-xl bg-gray-200 flex-shrink-0">
                    <img src={getDisplayImageUrl(u)} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
                <div className="truncate text-[12px] font-bold text-gray-700">{`${answerImageUrls.length}장 첨부됨`}</div>
              </div>
              <button type="button" onClick={() => setAnswerImageUrls([])} className="text-[12px] font-extrabold text-gray-500">
                전체 제거
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <BottomNavigation />
      </div>
    </div>
  );
}

