import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { fetchPostByIdSupabase, updatePostSupabase, deletePostSupabase } from '../api/postsSupabase';

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '').trim());
const isQuestionPost = (p) => String(p?.category || '').toLowerCase() === 'question';

export default function AskSituationEditScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const passed = location.state?.post || null;
  const [post, setPost] = useState(passed);
  const [loading, setLoading] = useState(!passed);
  const [text, setText] = useState(String(passed?.content || passed?.note || '').trim());
  const [busy, setBusy] = useState(false);

  const canEdit = useMemo(() => {
    if (!user || !post) return false;
    if (!isQuestionPost(post)) return false;
    const authorId = String(post.userId || post.user?.id || post.user_id || '').trim();
    return authorId && String(authorId) === String(user.id);
  }, [post, user]);

  useEffect(() => {
    (async () => {
      const pid = String(id || '').trim();
      if (!isUuid(pid)) return;
      if (passed) return;
      setLoading(true);
      try {
        const fresh = await fetchPostByIdSupabase(pid, user?.id || null);
        if (fresh) {
          setPost(fresh);
          setText(String(fresh.content || fresh.note || '').trim());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, passed, user?.id]);

  const onSave = useCallback(async () => {
    if (!post?.id || !canEdit || busy) return;
    const next = String(text || '').trim();
    if (!next) {
      alert('내용을 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await updatePostSupabase(String(post.id), { content: next });
      if (!res?.success) throw new Error('update_failed');
      alert('질문이 수정됐어요.');
      navigate(`/ask-situation/${encodeURIComponent(String(post.id))}`, { replace: true });
    } catch {
      alert('수정에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }, [busy, canEdit, navigate, post?.id, text]);

  const onDelete = useCallback(async () => {
    if (!post?.id || !canEdit || busy) return;
    if (!window.confirm('이 질문을 삭제할까요?')) return;
    setBusy(true);
    try {
      const res = await deletePostSupabase(String(post.id));
      if (!res?.success) throw new Error('delete_failed');
      alert('삭제됐어요.');
      navigate('/ask-situation', { replace: true });
    } catch {
      alert('삭제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }, [busy, canEdit, navigate, post?.id]);

  if (loading && !post) {
    return (
      <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
        <div className="screen-content flex items-center justify-center bg-white">
          <div className="text-[13px] text-gray-500">불러오는 중…</div>
        </div>
      </div>
    );
  }

  if (!post || !isQuestionPost(post)) {
    return (
      <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
        <div className="screen-content bg-white">
          <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 pt-12 bg-white">
            <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
              <ArrowLeft className="h-5 w-5 text-gray-800" />
            </button>
            <h1 className="text-base font-bold text-gray-900">질문 수정</h1>
          </header>
          <div className="p-4 text-[13px] text-gray-500">질문 글을 찾을 수 없어요.</div>
          <BottomNavigation />
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
        <div className="screen-content bg-white">
          <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 pt-12 bg-white">
            <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
              <ArrowLeft className="h-5 w-5 text-gray-800" />
            </button>
            <h1 className="text-base font-bold text-gray-900">질문 수정</h1>
          </header>
          <div className="p-4 text-[13px] text-gray-500">작성자만 수정/삭제할 수 있어요.</div>
          <BottomNavigation />
        </div>
      </div>
    );
  }

  const locationLabel = String(post.location || post.detailedLocation || post.placeName || post.region || '').trim();

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
      <div className="screen-content bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 pt-12 bg-white">
          <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
            <ArrowLeft className="h-5 w-5 text-gray-800" />
          </button>
          <h1 className="text-base font-bold text-gray-900">질문 수정</h1>
          <button type="button" onClick={onDelete} disabled={busy} className="text-[13px] font-extrabold text-red-500 disabled:opacity-40">
            삭제
          </button>
        </header>

        <div className="px-4 py-4 pb-28">
          <div className="mb-3">
            <div className="text-[12px] font-extrabold text-gray-700">위치</div>
            <div className="mt-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-900">
              {locationLabel || '위치 정보 없음'}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[12px] font-extrabold text-gray-700">내용</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full min-h-[160px] resize-none rounded-2xl border border-gray-200 bg-white p-4 text-[13px] font-semibold text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="질문 내용을 입력해 주세요."
            />
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="mt-2 w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold text-white disabled:opacity-40"
            style={{ background: '#26C6DA' }}
          >
            저장
          </button>
        </div>

        <BottomNavigation />
      </div>
    </div>
  );
}

