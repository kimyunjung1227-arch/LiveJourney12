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
const encodeAnswerContent = ({ text, imageUrl }) => {
  const t = String(text || '').trim();
  const img = imageUrl ? String(imageUrl).trim() : '';
  if (!img) return t;
  return JSON.stringify({ t, img });
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
    return { text: String(text || '').trim(), imageUrl };
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
  const [loading, setLoading] = useState(!passed);
  const [comments, setComments] = useState([]);
  const [acceptedCommentId, setAcceptedCommentId] = useState(null);
  const [acceptBusyId, setAcceptBusyId] = useState(null);

  const [answerText, setAnswerText] = useState('');
  const [answerUploading, setAnswerUploading] = useState(false);
  const [answerImageUrl, setAnswerImageUrl] = useState(null);
  const fileRef = useRef(null);

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapErr, setMapErr] = useState(null);
  const floatingLayerStyle = useMemo(() => ({
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(720px, 100vw)',
    zIndex: 60,
  }), []);

  const coords = useMemo(() => {
    const c = post?.coordinates || post?.exifData?.map_pin || null;
    const lat = c ? Number(c.lat) : NaN;
    const lng = c ? Number(c.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [post]);

  const canAccept = useMemo(() => {
    if (!user || !post) return false;
    if (!isQuestionPost(post)) return false;
    const authorId = String(post.userId || post.user?.id || post.user_id || '').trim();
    return authorId && String(authorId) === String(user.id);
  }, [post, user]);

  const loadAccepted = useCallback(async (pid) => {
    try {
      if (!pid || !isUuid(pid)) return;
      const { data, error } = await supabase.from('help_answer_accepts').select('comment_id').eq('post_id', pid).maybeSingle();
      if (error) return;
      setAcceptedCommentId(data?.comment_id || null);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    const pid = String(id || '').trim();
    if (!isUuid(pid)) return;
    setLoading(true);
    try {
      const fresh = await fetchPostByIdSupabase(pid, user?.id || null);
      if (fresh) setPost(fresh);
      const rows = await fetchCommentsForPostSupabase(pid);
      const mapped = (rows || []).map((c) => {
        const payload = decodeAnswerContent(c.content);
        return {
          id: String(c.id),
          userId: c.user_id ? String(c.user_id) : null,
          user: c.user_id ? { id: String(c.user_id), username: c.username || null, profileImage: c.avatar_url || null } : (c.username || '유저'),
          createdAt: c.created_at || null,
          avatar: c.avatar_url || null,
          text: payload.text,
          imageUrl: payload.imageUrl,
        };
      });
      setComments(mapped);
      await loadAccepted(pid);
    } catch (e) {
      logger.warn('AskSituationDetail load 실패:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [id, loadAccepted, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

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
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!user?.id) {
      alert('로그인 후 답변할 수 있어요.');
      return;
    }
    setAnswerUploading(true);
    try {
      const res = await uploadImage(file, user.id);
      const url = res?.imageUrl || res?.url || null;
      if (!url) throw new Error('upload_failed');
      setAnswerImageUrl(getDisplayImageUrl(url));
    } catch {
      alert('사진 업로드에 실패했어요.');
    } finally {
      setAnswerUploading(false);
      try { e.target.value = ''; } catch { /* ignore */ }
    }
  }, [user?.id]);

  const submitAnswer = useCallback(async () => {
    if (!post?.id || !isUuid(String(post.id))) return;
    if (!user?.id) {
      alert('로그인 후 답변할 수 있어요.');
      return;
    }
    const text = String(answerText || '').trim();
    if (!text && !answerImageUrl) {
      alert('답변 내용을 입력하거나 사진을 첨부해 주세요.');
      return;
    }
    try {
      const payload = encodeAnswerContent({ text, imageUrl: answerImageUrl });
      const { data, error } = await supabase.from('post_comments').insert({
        post_id: String(post.id),
        user_id: String(user.id),
        username: user.username || user.email?.split('@')?.[0] || '유저',
        avatar_url: user.profileImage || user.avatar_url || null,
        content: payload,
      }).select('*').single();
      if (error) throw error;
      setAnswerText('');
      setAnswerImageUrl(null);
      setComments((prev) => ([
        ...prev,
        {
          id: String(data.id),
          userId: String(user.id),
          user: { id: String(user.id), username: user.username || null, profileImage: user.profileImage || null },
          createdAt: data.created_at || null,
          avatar: user.profileImage || null,
          text,
          imageUrl: answerImageUrl,
        },
      ]));
    } catch (e) {
      alert('답변 등록에 실패했어요.');
      logger.warn('submitAnswer 실패:', e?.message);
    }
  }, [answerImageUrl, answerText, post?.id, user]);

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
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 pt-12">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
          <ArrowLeft className="h-5 w-5 text-gray-800" />
        </button>
        <h1 className="text-base font-bold text-gray-900">현장 상황 질문</h1>
      </header>

      <div className="flex-1 px-4 py-4 pb-28">
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
          <div className="mt-1 rounded-2xl border border-gray-200 bg-white p-4 text-[15px] font-extrabold leading-relaxed text-gray-900">
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
              comments.map((c) => {
                const avatar = c?.avatar || (typeof c.user === 'object' ? c.user?.profileImage : null) || null;
                const name = (typeof c.user === 'object' ? c.user?.username : null) || '유저';
                const img = c.imageUrl ? getDisplayImageUrl(c.imageUrl) : null;
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

                    {img ? (
                      <div className="mt-2 overflow-hidden rounded-xl bg-gray-100" style={{ width: '100%', height: 180 }}>
                        <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      </div>
                    ) : null}

                    {c.text ? (
                      <div className="mt-2 text-[13px] font-semibold leading-relaxed text-gray-800">
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

      {/* 하단: 답변 입력(카메라) */}
      <div
        style={{
          ...floatingLayerStyle,
          bottom: 64,
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid #eef2f7',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center gap-2">
          <input
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="사진과 함께 답변하면 채택 확률이 높아져요!"
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-semibold text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={answerUploading}
            aria-label="사진 첨부"
            className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 disabled:opacity-40"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0ea5e9', fontVariationSettings: "'wght' 300" }}>
              photo_camera
            </span>
          </button>
          <button
            type="button"
            onClick={submitAnswer}
            disabled={answerUploading}
            className="rounded-2xl px-4 py-3 text-[13px] font-extrabold text-white disabled:opacity-40"
            style={{ background: '#0ea5e9' }}
          >
            등록
          </button>
        </div>
        {answerImageUrl ? (
          <div className="mt-2">
            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-10 w-10 overflow-hidden rounded-xl bg-gray-200 flex-shrink-0">
                  <img src={getDisplayImageUrl(answerImageUrl)} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="truncate text-[12px] font-bold text-gray-700">사진이 첨부됐어요</div>
              </div>
              <button type="button" onClick={() => setAnswerImageUrl(null)} className="text-[12px] font-extrabold text-gray-500">
                제거
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <BottomNavigation />
    </div>
  );
}

